import hashlib
import secrets


def hash_external_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def verify_external_api_key(raw_key: str, key_hash: str) -> bool:
    return secrets.compare_digest(hash_external_api_key(raw_key), key_hash)
