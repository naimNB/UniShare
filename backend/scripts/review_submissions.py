#!/usr/bin/env python3
"""
UniShare Developer Review CLI
-----------------------------
Local CLI tool for repository maintainers to inspect, approve, or reject
moderated student note submissions without exposing public admin endpoints.

Usage:
    python backend/scripts/review_submissions.py list [--status pending|approved|rejected|all]
    python backend/scripts/review_submissions.py show <submission_id>
    python backend/scripts/review_submissions.py approve <submission_id>
    python backend/scripts/review_submissions.py reject <submission_id> [--reason "Reason"]
"""

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import select
from backend.app.config import STORAGE_DIR, SUBMISSIONS_DIR
from backend.app.database import SessionLocal, init_db
from backend.app.models import Category, Course, Resource, Submission, utc_now
from backend.app.storage import get_storage_backend



def format_size(size_bytes: int | None) -> str:
    """Format file size in KB or MB."""
    if not size_bytes:
        return "0 B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def cmd_list(args):
    """List submissions filtered by status."""
    db = SessionLocal()
    try:
        stmt = select(Submission).order_by(Submission.created_at.desc())
        if args.status and args.status.lower() != "all":
            stmt = stmt.where(Submission.status == args.status.lower())

        submissions = db.scalars(stmt).all()
        if not submissions:
            filter_text = f" with status '{args.status}'" if args.status and args.status != "all" else ""
            print(f"No student submissions found{filter_text}.")
            return 0

        print(f"\nFound {len(submissions)} submission(s):\n")
        header = f"{'ID':<5} | {'Status':<9} | {'Date':<12} | {'Course':<10} | {'Category':<16} | {'Size':<9} | {'Title'}"
        print(header)
        print("-" * len(header) + "-" * 20)

        for sub in submissions:
            date_str = sub.created_at.strftime("%Y-%m-%d") if sub.created_at else "—"
            course_code = sub.course.code if sub.course else f"ID:{sub.course_id}"
            cat_name = sub.category.name if sub.category else f"ID:{sub.category_id}"
            status_display = sub.status.upper()
            title_truncated = sub.title if len(sub.title) <= 40 else sub.title[:37] + "..."
            print(
                f"{sub.id:<5} | {status_display:<9} | {date_str:<12} | {course_code:<10} | {cat_name:<16} | {format_size(sub.file_size):<9} | {title_truncated}"
            )
        print()
        return 0
    finally:
        db.close()


def cmd_show(args):
    """Inspect metadata and local staged file path for a submission."""
    db = SessionLocal()
    try:
        sub = db.scalar(select(Submission).where(Submission.id == args.id))
        if not sub:
            print(f"Error: Submission with ID {args.id} not found.", file=sys.stderr)
            return 1

        storage = get_storage_backend()
        staged_exists = storage.staged_file_exists(sub.file_path)

        print(f"\n--- Submission #{sub.id} Details ---")
        print(f"Title:             {sub.title}")
        print(f"Status:            {sub.status.upper()}")
        print(f"Created At:        {sub.created_at}")
        print(f"Reviewed At:       {sub.reviewed_at or 'Not yet reviewed'}")
        if sub.rejection_reason:
            print(f"Rejection Reason:  {sub.rejection_reason}")
        print(f"Course:            {sub.course.code} – {sub.course.name} (Semester {sub.course.semester})" if sub.course else sub.course_id)
        print(f"Category:          {sub.category.name}" if sub.category else sub.category_id)
        print(f"Contributor:       {sub.contributor_name or 'Anonymous'}")
        print(f"Original Filename: {sub.original_filename}")
        print(f"File Size:         {format_size(sub.file_size)} ({sub.file_size} bytes)")
        print(f"Staged Filename:   {sub.file_path}")
        print(f"Staged Exists:     {'YES' if staged_exists else 'MISSING'}")

        if sub.description:
            print(f"Description:\n  {sub.description}")
        print()
        return 0
    finally:
        db.close()


def cmd_approve(args):
    """Approve a pending submission and promote it to an active Resource record."""
    db = SessionLocal()
    try:
        sub = db.scalar(select(Submission).where(Submission.id == args.id))
        if not sub:
            print(f"Error: Submission with ID {args.id} not found.", file=sys.stderr)
            return 1

        if sub.status != "pending":
            print(f"Error: Submission #{sub.id} is already marked as '{sub.status}'. Only 'pending' submissions can be approved.", file=sys.stderr)
            return 1

        storage = get_storage_backend()
        if not storage.staged_file_exists(sub.file_path):
            print(f"Error: Staged file '{sub.file_path}' does not exist in staging storage.", file=sys.stderr)
            return 1

        # Promote file to public storage via abstraction
        try:
            storage.promote_to_public(sub.file_path)
        except Exception as exc:
            print(f"Error: Failed to promote file to storage: {exc}", file=sys.stderr)
            return 1

        # Create active Resource record
        resource = Resource(
            title=sub.title,
            description=sub.description,
            course_id=sub.course_id,
            category_id=sub.category_id,
            file_path=sub.file_path,
            original_filename=sub.original_filename,
            mime_type=sub.mime_type,
            file_size=sub.file_size,
            created_at=utc_now(),
            download_count=0,
        )

        sub.status = "approved"
        sub.reviewed_at = utc_now()

        try:
            db.add(resource)
            db.commit()
            db.refresh(resource)
        except Exception as exc:
            db.rollback()
            storage.delete_public_file(sub.file_path)
            print(f"Error during approval transaction: {exc}", file=sys.stderr)
            return 1

        # NOTE: Original staged file in private storage is preserved for audit trail
        course_code = sub.course.code if sub.course else f"Course #{sub.course_id}"
        print(f"\n[APPROVED] Submission #{sub.id} approved successfully!")
        print(f"Published as Resource ID: {resource.id}")
        print(f"Title: '{resource.title}' under {course_code}")
        print(f"Storage path: {storage.get_public_url(sub.file_path)}\n")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error during approval process: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def cmd_reject(args):
    """Reject a pending submission and remove the staged file from disk."""
    db = SessionLocal()
    try:
        sub = db.scalar(select(Submission).where(Submission.id == args.id))
        if not sub:
            print(f"Error: Submission with ID {args.id} not found.", file=sys.stderr)
            return 1

        if sub.status != "pending":
            print(f"Error: Submission #{sub.id} is already '{sub.status}'.", file=sys.stderr)
            return 1

        reason = args.reason or "Does not meet academic submission quality guidelines."
        sub.status = "rejected"
        sub.rejection_reason = reason
        sub.reviewed_at = utc_now()

        # Remove staged file so it is never exposed publicly
        storage = get_storage_backend()
        storage.delete_staged_file(sub.file_path)

        db.commit()
        print(f"\n[REJECTED] Submission #{sub.id} has been rejected.")
        print(f"Reason: '{reason}'")
        print(f"Staged file safely removed: {sub.file_path}\n")

        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error during rejection transaction: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main():
    # Ensure tables exist
    init_db()

    parser = argparse.ArgumentParser(
        description="UniShare Maintainer Submission Review CLI"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # list
    p_list = subparsers.add_parser("list", help="List submissions")
    p_list.add_argument(
        "--status",
        choices=["pending", "approved", "rejected", "all"],
        default="pending",
        help="Filter submissions by review status (default: pending)",
    )
    p_list.set_defaults(func=cmd_list)

    # show
    p_show = subparsers.add_parser("show", help="Show full details of a submission")
    p_show.add_argument("id", type=int, help="Submission ID")
    p_show.set_defaults(func=cmd_show)

    # approve
    p_approve = subparsers.add_parser("approve", help="Approve and publish a submission")
    p_approve.add_argument("id", type=int, help="Submission ID to approve")
    p_approve.set_defaults(func=cmd_approve)

    # reject
    p_reject = subparsers.add_parser("reject", help="Reject a submission")
    p_reject.add_argument("id", type=int, help="Submission ID to reject")
    p_reject.add_argument("--reason", type=str, default=None, help="Rejection reason")
    p_reject.set_defaults(func=cmd_reject)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
