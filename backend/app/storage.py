"""
UniShare Storage Abstraction Layer
----------------------------------
Supports modular file operations for academic documents across:
- Local filesystem storage (development & local testing)
- Supabase Object Storage (production cloud deployment with private/public buckets)
"""

import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from backend.app.config import (
    STORAGE_BACKEND,
    STORAGE_DIR,
    SUBMISSIONS_DIR,
    SUPABASE_PRIVATE_BUCKET,
    SUPABASE_PUBLIC_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)


class StorageError(Exception):
    """Base exception for storage errors."""
    pass


class StorageConfigurationError(StorageError):
    """Raised when cloud storage backend is requested without valid credentials or configuration."""
    pass


class BaseStorageBackend(ABC):
    """Abstract contract for document staging, promotion, and public retrieval."""

    @abstractmethod
    def save_staged_file(self, filename: str, content: bytes) -> str:
        """Store an uploaded student note in private staging."""
        pass

    @abstractmethod
    def read_staged_file(self, filename: str) -> bytes:
        """Read bytes of a staged file."""
        pass

    @abstractmethod
    def staged_file_exists(self, filename: str) -> bool:
        """Check whether a staged document exists in private storage."""
        pass

    @abstractmethod
    def delete_staged_file(self, filename: str) -> bool:
        """Delete a staged document from private storage."""
        pass

    @abstractmethod
    def promote_to_public(self, filename: str) -> str:
        """
        Promote a staged file from private staging to public resources.
        Returns the resolved public storage identifier.
        """
        pass

    @abstractmethod
    def save_public_file(self, filename: str, content: bytes) -> str:
        """
        Store an approved resource directly into public/approved storage.
        Returns the resolved storage identifier.
        """
        pass

    @abstractmethod
    def read_public_file(self, filename: str) -> bytes:
        """Read bytes of a published resource."""
        pass

    @abstractmethod
    def public_file_exists(self, filename: str) -> bool:
        """Check whether a published document exists in public storage."""
        pass

    @abstractmethod
    def delete_public_file(self, filename: str) -> bool:
        """Delete a published document from public storage."""
        pass

    @abstractmethod
    def get_public_url(self, filename: str) -> str:
        """Get the public download/preview URL or path for a published document."""
        pass


class LocalStorageBackend(BaseStorageBackend):
    """Local filesystem implementation using STORAGE_DIR (public) and SUBMISSIONS_DIR (private)."""

    def __init__(self, storage_dir: Optional[Path] = None, submissions_dir: Optional[Path] = None):
        import backend.app.config as cfg
        self.storage_dir = Path(storage_dir if storage_dir is not None else cfg.STORAGE_DIR).resolve()
        self.submissions_dir = Path(submissions_dir if submissions_dir is not None else cfg.SUBMISSIONS_DIR).resolve()
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.submissions_dir.mkdir(parents=True, exist_ok=True)


    def _resolve_safe(self, base_dir: Path, filename: str) -> Path:
        """Resolve a filename securely inside base_dir, preventing path traversal."""
        resolved = (base_dir / filename).resolve()
        try:
            resolved.relative_to(base_dir)
        except ValueError as exc:
            raise StorageError(f"Security violation: path traversal attempt for '{filename}'") from exc
        return resolved

    def save_staged_file(self, filename: str, content: bytes) -> str:
        target = self._resolve_safe(self.submissions_dir, filename)
        target.write_bytes(content)
        return filename

    def read_staged_file(self, filename: str) -> bytes:
        target = self._resolve_safe(self.submissions_dir, filename)
        if not target.is_file():
            raise FileNotFoundError(f"Staged file '{filename}' not found.")
        return target.read_bytes()

    def staged_file_exists(self, filename: str) -> bool:
        target = self._resolve_safe(self.submissions_dir, filename)
        return target.is_file()

    def delete_staged_file(self, filename: str) -> bool:
        target = self._resolve_safe(self.submissions_dir, filename)
        if target.is_file():
            target.unlink(missing_ok=True)
            return True
        return False

    def promote_to_public(self, filename: str) -> str:
        source = self._resolve_safe(self.submissions_dir, filename)
        dest = self._resolve_safe(self.storage_dir, filename)
        if not source.is_file():
            raise FileNotFoundError(f"Source staged file '{filename}' does not exist.")
        shutil.copy2(source, dest)
        return filename

    def save_public_file(self, filename: str, content: bytes) -> str:
        target = self._resolve_safe(self.storage_dir, filename)
        target.write_bytes(content)
        return filename

    def read_public_file(self, filename: str) -> bytes:
        target = self._resolve_safe(self.storage_dir, filename)
        if not target.is_file():
            raise FileNotFoundError(f"Public file '{filename}' not found.")
        return target.read_bytes()

    def public_file_exists(self, filename: str) -> bool:
        target = self._resolve_safe(self.storage_dir, filename)
        return target.is_file()

    def delete_public_file(self, filename: str) -> bool:
        target = self._resolve_safe(self.storage_dir, filename)
        if target.is_file():
            target.unlink(missing_ok=True)
            return True
        return False

    def get_public_url(self, filename: str) -> str:
        target = self._resolve_safe(self.storage_dir, filename)
        return str(target)


class SupabaseStorageBackend(BaseStorageBackend):
    """
    Supabase Storage implementation supporting a dual private-bucket architecture:
    - pending_bucket ('pending-submissions'): Staged uploads awaiting maintainer review.
    - approved_bucket ('approved-resources'): Approved resources accessible via signed URLs or authenticated download.
    Uses Supabase REST endpoints via HTTP for zero heavy client dependencies.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        approved_bucket: Optional[str] = None,
        pending_bucket: Optional[str] = None,
        # Backward-compatible parameter aliases
        public_bucket: Optional[str] = None,
        private_bucket: Optional[str] = None,
    ):
        import backend.app.config as cfg

        if supabase_url is not None:
            self.url = (cfg.clean_env_value(supabase_url) or "").rstrip("/")
        else:
            self.url = (cfg.SUPABASE_URL or "").rstrip("/")

        if service_role_key is not None:
            self.key = cfg.clean_env_value(service_role_key) or ""
        else:
            self.key = cfg.SUPABASE_SERVICE_ROLE_KEY or ""

        self.approved_bucket = approved_bucket or public_bucket or cfg.SUPABASE_APPROVED_BUCKET
        self.pending_bucket = pending_bucket or private_bucket or cfg.SUPABASE_PENDING_BUCKET
        # Aliases
        self.public_bucket = self.approved_bucket
        self.private_bucket = self.pending_bucket

        def is_placeholder_or_empty(v: Optional[str]) -> bool:
            if not v or not v.strip():
                return True
            lower = v.lower()
            if v.startswith("sb_secret_") or v.startswith("eyJ"):
                return False
            return "[" in lower or "placeholder" in lower or "<project" in lower

        if is_placeholder_or_empty(self.url) or is_placeholder_or_empty(self.key):
            raise StorageConfigurationError(
                "SupabaseStorageBackend requires valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
            )

    @property
    def headers(self) -> dict[str, str]:
        """
        Build authentication headers for Supabase REST requests.
        - Modern secret keys (sb_secret_*) are opaque tokens and must ONLY be passed
          in the `apikey` header (passing as Bearer causes 401 JWT decode errors).
        - Legacy JWT keys (eyJ...) and mock keys retain `Authorization: Bearer` for compatibility.
        """
        headers = {"apikey": self.key}
        if self.key and not self.key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def save_staged_file(self, filename: str, content: bytes) -> str:
        import httpx

        upload_url = f"{self.url}/storage/v1/object/{self.pending_bucket}/{filename}"
        headers = {**self.headers, "Content-Type": "application/pdf"}
        res = httpx.post(upload_url, content=content, headers=headers, timeout=15.0)
        if res.status_code not in (200, 201):
            raise StorageError(f"Supabase upload failed [{res.status_code}]: {res.text}")
        return filename

    def read_staged_file(self, filename: str) -> bytes:
        import httpx

        download_url = f"{self.url}/storage/v1/object/authenticated/{self.pending_bucket}/{filename}"
        res = httpx.get(download_url, headers=self.headers, timeout=15.0)
        if res.status_code == 404 or (res.status_code == 400 and "NoSuchKey" in res.text):
            raise FileNotFoundError(f"Staged file '{filename}' not found in Supabase.")
        if res.status_code != 200:
            raise StorageError(f"Supabase read failed [{res.status_code}]: {res.text}")
        return res.content

    def staged_file_exists(self, filename: str) -> bool:
        import httpx

        check_url = f"{self.url}/storage/v1/object/info/{self.pending_bucket}/{filename}"
        res = httpx.get(check_url, headers=self.headers, timeout=10.0)
        return res.status_code == 200

    def delete_staged_file(self, filename: str) -> bool:
        import httpx

        delete_url = f"{self.url}/storage/v1/object/{self.pending_bucket}"
        res = httpx.request("DELETE", delete_url, json={"prefixes": [filename]}, headers=self.headers, timeout=10.0)
        return res.status_code in (200, 204)

    def promote_to_public(self, filename: str) -> str:
        """Copy object from private pending bucket to approved resources bucket."""
        import httpx

        copy_url = f"{self.url}/storage/v1/object/copy"
        payload = {
            "bucketId": self.pending_bucket,
            "sourceKey": filename,
            "destinationBucket": self.approved_bucket,
            "destinationKey": filename,
        }
        res = httpx.post(copy_url, json=payload, headers=self.headers, timeout=15.0)
        if res.status_code not in (200, 201):
            raise StorageError(f"Supabase copy from staging to approved failed [{res.status_code}]: {res.text}")
        return filename

    def create_signed_url(self, bucket: str, filename: str, expires_in: int = 3600) -> str:
        """Generate a time-limited signed URL for private bucket objects."""
        import httpx

        sign_url = f"{self.url}/storage/v1/object/sign/{bucket}/{filename}"
        res = httpx.post(sign_url, json={"expiresIn": expires_in}, headers=self.headers, timeout=10.0)
        if res.status_code not in (200, 201):
            raise StorageError(f"Failed to generate signed URL [{res.status_code}]: {res.text}")
        signed_path = res.json().get("signedURL")
        return f"{self.url}/storage/v1{signed_path}"

    def save_public_file(self, filename: str, content: bytes, upsert: bool = False) -> str:
        """Store an approved resource directly into approved storage."""
        import httpx

        upload_url = f"{self.url}/storage/v1/object/{self.approved_bucket}/{filename}"
        headers = {**self.headers, "Content-Type": "application/pdf"}
        if upsert:
            headers["x-upsert"] = "true"
        res = httpx.post(upload_url, content=content, headers=headers, timeout=15.0)
        if res.status_code not in (200, 201):
            raise StorageError(f"Supabase upload to approved failed [{res.status_code}]: {res.text}")
        return filename

    def read_public_file(self, filename: str) -> bytes:
        import httpx

        download_url = f"{self.url}/storage/v1/object/authenticated/{self.approved_bucket}/{filename}"
        res = httpx.get(download_url, headers=self.headers, timeout=15.0)
        if res.status_code == 404 or (res.status_code == 400 and "NoSuchKey" in res.text):
            raise FileNotFoundError(f"Public file '{filename}' not found in Supabase.")
        if res.status_code != 200:
            raise StorageError(f"Supabase public read failed [{res.status_code}]: {res.text}")
        return res.content

    def public_file_exists(self, filename: str) -> bool:
        import httpx

        check_url = f"{self.url}/storage/v1/object/info/{self.approved_bucket}/{filename}"
        res = httpx.get(check_url, headers=self.headers, timeout=10.0)
        return res.status_code == 200

    def delete_public_file(self, filename: str) -> bool:
        import httpx

        delete_url = f"{self.url}/storage/v1/object/{self.approved_bucket}"
        res = httpx.request("DELETE", delete_url, json={"prefixes": [filename]}, headers=self.headers, timeout=10.0)
        return res.status_code in (200, 204)

    def get_public_url(self, filename: str) -> str:
        """Return signed access URL for private approved resources bucket."""
        try:
            return self.create_signed_url(self.approved_bucket, filename, expires_in=3600)
        except Exception:
            return f"{self.url}/storage/v1/object/public/{self.approved_bucket}/{filename}"


def get_storage_backend(backend_type: Optional[str] = None) -> BaseStorageBackend:
    """Factory creating the configured storage backend. Defaults to local filesystem."""
    import backend.app.config as cfg
    selected = (backend_type or cfg.STORAGE_BACKEND or "local").strip().lower()

    if selected == "local":
        return LocalStorageBackend(storage_dir=cfg.STORAGE_DIR, submissions_dir=cfg.SUBMISSIONS_DIR)

    if selected == "supabase":
        return SupabaseStorageBackend(
            supabase_url=cfg.SUPABASE_URL,
            service_role_key=cfg.SUPABASE_SERVICE_ROLE_KEY,
            approved_bucket=cfg.SUPABASE_APPROVED_BUCKET,
            pending_bucket=cfg.SUPABASE_PENDING_BUCKET,
        )

    raise ValueError(f"Unsupported storage backend '{selected}'. Supported: 'local', 'supabase'.")
