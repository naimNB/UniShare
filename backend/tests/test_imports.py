from pathlib import Path
from uuid import UUID

import pytest
from pypdf import PdfWriter
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from backend.app.models import Category, Resource
from backend.scripts import seed


def make_pdf(path: Path, content: str = "Original document") -> Path:
    seed.generate_sample_pdf(path, content, "Import regression test", [content])
    return path


def import_pdf(db_session, source, title="Imported document", category="Lecture Notes"):
    return seed.import_local_file(
        source, "CSE 3101", category, title, "Imported description", db=db_session
    )


def test_colliding_titles_keep_distinct_files(db_session, test_env, tmp_path):
    first_source = make_pdf(tmp_path / "first.pdf", "First document")
    second_source = make_pdf(tmp_path / "বাংলা.pdf", "Second document")
    first = import_pdf(db_session, first_source, "Collision-A")
    second = import_pdf(db_session, second_source, "Collision A")

    assert first.id != second.id
    assert first.file_path != second.file_path
    assert first.original_filename == "first.pdf"
    assert second.original_filename == "বাংলা.pdf"
    assert (test_env["storage_dir"] / first.file_path).read_bytes() == first_source.read_bytes()
    assert (test_env["storage_dir"] / second.file_path).read_bytes() == second_source.read_bytes()


def test_duplicate_import_updates_metadata_and_category(db_session, test_env, tmp_path):
    first_source = make_pdf(tmp_path / "first.pdf")
    resource = import_pdf(db_session, first_source)
    original_id, original_path = resource.id, resource.file_path
    original_created_at = resource.created_at
    resource.download_count = 17
    db_session.commit()
    second_source = make_pdf(tmp_path / "replacement.pdf", "Replacement content")

    replaced = import_pdf(db_session, second_source, " Imported document ", "Lab Manuals")

    category = db_session.scalar(select(Category).where(Category.name == "Lab Manuals"))
    assert replaced.id == original_id
    assert replaced.category_id == category.id
    assert replaced.original_filename == second_source.name
    assert replaced.file_size == second_source.stat().st_size
    assert replaced.download_count == 17
    assert replaced.created_at == original_created_at
    assert replaced.file_path != original_path
    assert not (test_env["storage_dir"] / original_path).exists()
    assert (test_env["storage_dir"] / replaced.file_path).read_bytes() == second_source.read_bytes()
    assert len(db_session.scalars(select(Resource)).all()) == 3


def test_replacement_retains_shared_legacy_file(db_session, test_env, tmp_path):
    source = make_pdf(tmp_path / "first.pdf")
    first = import_pdf(db_session, source)
    old_path = first.file_path
    shared = Resource(
        title="Legacy shared file", course_id=first.course_id, category_id=first.category_id,
        file_path=f"./{old_path}", original_filename=source.name,
        mime_type="application/pdf", file_size=source.stat().st_size,
    )
    db_session.add(shared)
    db_session.commit()

    import_pdf(db_session, make_pdf(tmp_path / "replacement.pdf", "Replacement"))

    assert (test_env["storage_dir"] / old_path).read_bytes() == source.read_bytes()


@pytest.mark.parametrize("replace_existing", [False, True])
def test_database_failure_rolls_back_and_cleans_new_file(
    db_session, test_env, tmp_path, monkeypatch, replace_existing
):
    old_resource = None
    if replace_existing:
        old_resource = import_pdf(db_session, make_pdf(tmp_path / "old.pdf"))
        old_id, old_path, old_category = old_resource.id, old_resource.file_path, old_resource.category_id
        old_bytes = (test_env["storage_dir"] / old_path).read_bytes()
    files_before = set(test_env["storage_dir"].iterdir())
    count_before = len(db_session.scalars(select(Resource)).all())

    def fail_commit():
        db_session.flush()  # Exercise rollback of already-written SQL as well.
        raise SQLAlchemyError("simulated database failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)
    with pytest.raises(SQLAlchemyError, match="simulated"):
        import_pdf(db_session, make_pdf(tmp_path / "new.pdf", "New bytes"), category="Lab Manuals")

    assert set(test_env["storage_dir"].iterdir()) == files_before
    assert len(db_session.scalars(select(Resource)).all()) == count_before
    if old_resource:
        original = db_session.get(Resource, old_id)
        assert original.file_path == old_path
        assert original.original_filename == "old.pdf"
        assert original.category_id == old_category
        assert (test_env["storage_dir"] / old_path).read_bytes() == old_bytes


def test_post_commit_refresh_failure_keeps_committed_file(db_session, test_env, tmp_path, monkeypatch):
    source = make_pdf(tmp_path / "new.pdf")

    def fail_refresh(_resource):
        raise SQLAlchemyError("simulated refresh failure")

    monkeypatch.setattr(db_session, "refresh", fail_refresh)
    with pytest.raises(SQLAlchemyError, match="refresh"):
        import_pdf(db_session, source)

    with test_env["SessionLocal"]() as verification_session:
        saved = verification_session.scalar(select(Resource).where(Resource.title == "Imported document"))
        assert saved is not None
        assert (test_env["storage_dir"] / saved.file_path).read_bytes() == source.read_bytes()


def test_exclusive_creation_does_not_overwrite_on_uuid_collision(
    db_session, test_env, tmp_path, monkeypatch
):
    fixed_id = UUID(int=1)
    monkeypatch.setattr(seed, "uuid4", lambda: fixed_id)
    existing_file = test_env["storage_dir"] / f"resource_{fixed_id.hex}.pdf"
    existing_file.write_bytes(b"Existing bytes must survive")

    with pytest.raises(FileExistsError):
        import_pdf(db_session, make_pdf(tmp_path / "new.pdf"))

    assert existing_file.read_bytes() == b"Existing bytes must survive"


@pytest.mark.parametrize("course,category", [
    ("MISSING 999", "Lecture Notes"), ("CSE 3101", "Missing Category"),
])
def test_unknown_course_or_category_creates_no_files(db_session, test_env, tmp_path, course, category):
    files_before = set(test_env["storage_dir"].iterdir())
    with pytest.raises(ValueError, match="does not exist"):
        seed.import_local_file(make_pdf(tmp_path / "new.pdf"), course, category, "Title", db=db_session)
    assert set(test_env["storage_dir"].iterdir()) == files_before


@pytest.mark.parametrize("content", [b"Text disguised as PDF", b"%PDF-1.4\n%%EOF\n"])
def test_invalid_pdf_content_is_rejected(db_session, test_env, tmp_path, content):
    source = tmp_path / "fake.pdf"
    source.write_bytes(content)
    files_before = set(test_env["storage_dir"].iterdir())
    with pytest.raises(ValueError, match="Invalid or unsupported PDF"):
        import_pdf(db_session, source)
    assert set(test_env["storage_dir"].iterdir()) == files_before


def test_truncated_pdf_is_rejected(tmp_path):
    source = make_pdf(tmp_path / "truncated.pdf")
    source.write_bytes(source.read_bytes()[:100])
    with pytest.raises(ValueError, match="Invalid or unsupported PDF"):
        seed.validate_file(source)


@pytest.mark.parametrize("encrypted", [False, True])
def test_zero_page_and_encrypted_pdfs_rejected(tmp_path, encrypted):
    source = tmp_path / "unsupported.pdf"
    writer = PdfWriter()
    if encrypted:
        writer.add_blank_page(width=100, height=100)
        writer.encrypt("secret")
    writer.write(source)
    with pytest.raises(ValueError, match="Encrypted|at least one page"):
        seed.validate_file(source)


def test_empty_oversized_unsupported_and_missing_files(tmp_path):
    source = tmp_path / "empty.pdf"
    source.touch()
    with pytest.raises(ValueError, match="empty"):
        seed.validate_file(source)
    with source.open("wb") as stream:
        stream.truncate(seed.MAX_FILE_SIZE_BYTES + 1)
    with pytest.raises(ValueError, match="maximum size"):
        seed.validate_file(source)
    unsupported = tmp_path / "program.exe"
    unsupported.write_bytes(b"not allowed")
    with pytest.raises(ValueError, match="not permitted"):
        seed.validate_file(unsupported)
    with pytest.raises(ValueError, match="not found"):
        seed.validate_file(tmp_path / "missing.pdf")


def test_copy_failure_cleans_partial_file(db_session, test_env, tmp_path, monkeypatch):
    source = make_pdf(tmp_path / "valid.pdf")
    files_before = set(test_env["storage_dir"].iterdir())

    def fail_copy(_source, destination):
        destination.write(b"partial copy")
        raise OSError("simulated disk failure")

    monkeypatch.setattr(seed.shutil, "copyfileobj", fail_copy)
    with pytest.raises(OSError, match="disk failure"):
        import_pdf(db_session, source)
    assert set(test_env["storage_dir"].iterdir()) == files_before


def test_validation_of_copied_bytes_cleans_corrupt_snapshot(db_session, test_env, tmp_path, monkeypatch):
    source = make_pdf(tmp_path / "valid.pdf")
    files_before = set(test_env["storage_dir"].iterdir())
    monkeypatch.setattr(seed.shutil, "copyfileobj", lambda _source, target: target.write(b"corrupted"))
    with pytest.raises(ValueError, match="Invalid or unsupported PDF"):
        import_pdf(db_session, source)
    assert set(test_env["storage_dir"].iterdir()) == files_before


def test_failed_old_file_cleanup_does_not_fail_committed_import(
    db_session, test_env, tmp_path, monkeypatch, caplog
):
    resource = import_pdf(db_session, make_pdf(tmp_path / "old.pdf"))
    old_path = test_env["storage_dir"] / resource.file_path
    unlink = Path.unlink

    def fail_old_unlink(path, *args, **kwargs):
        if path == old_path:
            raise OSError("simulated cleanup failure")
        return unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_old_unlink)
    updated = import_pdf(db_session, make_pdf(tmp_path / "new.pdf", "Replacement"))
    assert updated.original_filename == "new.pdf"
    assert (test_env["storage_dir"] / updated.file_path).exists()
    assert old_path.exists()
    assert "Could not clean up" in caplog.text


def test_existing_non_pdf_import_remains_supported(db_session, tmp_path):
    source = tmp_path / "notes.txt"
    source.write_text("Plain text notes", encoding="utf-8")
    resource = import_pdf(db_session, source)
    assert resource.mime_type == "text/plain"


def test_reference_query_failure_keeps_old_file(db_session, test_env, tmp_path, monkeypatch, caplog):
    resource = import_pdf(db_session, make_pdf(tmp_path / "old.pdf"))
    previous_name = resource.file_path

    def fail_reference_check(*_args, **_kwargs):
        raise SQLAlchemyError("simulated reference lookup failure")

    monkeypatch.setattr(db_session, "execute", fail_reference_check)
    seed.remove_replaced_file(db_session, previous_name, "new-file.pdf")
    assert (test_env["storage_dir"] / previous_name).exists()
    assert "Could not clean up" in caplog.text


def test_cleanup_never_deletes_outside_storage(db_session, tmp_path, caplog):
    outside_file = tmp_path / "outside.pdf"
    outside_file.write_bytes(b"An external source document")
    seed.remove_replaced_file(db_session, "../outside.pdf", "new-file.pdf")
    assert outside_file.read_bytes() == b"An external source document"
    assert "Could not clean up" in caplog.text


def test_rollback_error_does_not_skip_file_cleanup(db_session, test_env, tmp_path, monkeypatch):
    source = make_pdf(tmp_path / "new.pdf")
    files_before = set(test_env["storage_dir"].iterdir())
    rollback = db_session.rollback

    def fail_commit():
        raise SQLAlchemyError("original commit failure")

    def fail_rollback():
        rollback()
        raise SQLAlchemyError("secondary rollback failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)
    monkeypatch.setattr(db_session, "rollback", fail_rollback)
    with pytest.raises(SQLAlchemyError, match="original commit failure"):
        import_pdf(db_session, source)
    assert set(test_env["storage_dir"].iterdir()) == files_before
