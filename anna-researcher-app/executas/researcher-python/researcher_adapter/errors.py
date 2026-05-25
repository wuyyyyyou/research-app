from __future__ import annotations


class ResearcherError(Exception):
    """Base error with a stable user-facing code."""

    code = "internal_error"

    def __init__(self, message: str, *, data: dict | None = None):
        super().__init__(message)
        self.message = message
        self.data = data or {}


class InvalidActionError(ResearcherError):
    code = "invalid_action"


class ValidationError(ResearcherError):
    code = "invalid_params"


class NotFoundError(ResearcherError):
    code = "not_found"


class NotReadyError(ResearcherError):
    code = "not_ready"


class ConfigurationError(ResearcherError):
    code = "configuration_error"


class SamplingFailure(ResearcherError):
    code = "sampling_error"


class RetrievalFailure(ResearcherError):
    code = "retrieval_error"


class JobStoreError(ResearcherError):
    code = "job_store_error"

