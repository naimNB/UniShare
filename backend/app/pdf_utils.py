import io
import re
from pathlib import Path
from pypdf import PdfReader

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit


def sanitize_filename(filename: str | None) -> str:
    """
    Sanitize uploaded filename to prevent directory traversal and injection.
    Strips directory separators, null bytes, and non-printable control characters.
    """
    if not filename:
        return "document.pdf"

    # Remove any directory path components
    clean_name = Path(filename).name
    # Remove null bytes, control characters, and leading/trailing dots/spaces
    clean_name = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", clean_name)
    clean_name = clean_name.strip(" ./\t\r\n")

    if not clean_name:
        return "document.pdf"

    # Ensure it ends with .pdf
    if not clean_name.lower().endswith(".pdf"):
        clean_name += ".pdf"

    return clean_name[:255]


def validate_pdf_content(file_bytes: bytes, filename: str = "document.pdf") -> None:
    """
    Strictly validate PDF structure, pages, encryption, and size.
    Raises ValueError with a user-friendly message if validation fails.
    """
    if not file_bytes:
        raise ValueError("Uploaded file is empty (0 bytes).")

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(
            f"File exceeds maximum allowed upload size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
        )

    # Magic byte signature check
    if not file_bytes.startswith(b"%PDF-"):
        raise ValueError("Invalid file format. Uploaded file is not a valid PDF document.")

    # Check for EOF marker in trailing 2048 bytes
    trailing = file_bytes[-2048:]
    if b"%%EOF" not in trailing:
        raise ValueError("The PDF document is truncated or corrupted (missing EOF marker).")

    # Structural inspection using strict pypdf reader
    try:
        reader = PdfReader(io.BytesIO(file_bytes), strict=True)

        if reader.is_encrypted:
            raise ValueError("Password-protected or encrypted PDFs cannot be accepted. Please upload an unlocked PDF.")

        if not reader.pages:
            raise ValueError("The PDF must contain at least one page.")

        # Traverse all pages to verify page tree integrity
        for index, page in enumerate(reader.pages):
            if page.get("/Type") != "/Page":
                raise ValueError(f"The PDF contains an invalid page reference at page {index + 1}.")
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(f"Unable to parse PDF document structure: {exc}") from exc
