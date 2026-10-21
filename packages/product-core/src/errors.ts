export const productErrorCodes = [
  "ARCHIVE_INVALID",
  "ARCHIVE_LIMIT_EXCEEDED",
  "ARCHIVE_PATH_UNSAFE",
  "ARCHIVE_ENTRY_UNSUPPORTED",
  "ARCHIVE_SENSITIVE_CONTENT",
  "SPEC_MISSING",
  "SNAPSHOT_INTEGRITY",
  "RUN_NOT_FOUND",
  "RUN_CONFLICT",
  "RUN_INVALID_TRANSITION",
  "RUN_STORE_CORRUPT",
  "REVIEW_OUTPUT_INVALID",
  "REVIEW_EVIDENCE_INCOMPLETE",
  "EXECUTOR_UNAVAILABLE",
  "EXECUTION_FORBIDDEN",
  "INTERNAL_ERROR",
] as const;

export type ProductErrorCode = (typeof productErrorCodes)[number];
export type ProductErrorCategory =
  "INPUT" | "SECURITY" | "STATE" | "REVIEW" | "INFRASTRUCTURE" | "INTERNAL";

export interface ProductErrorData {
  code: ProductErrorCode;
  category: ProductErrorCategory;
  message: string;
  retryable: boolean;
}

export interface ProductErrorOptions {
  category: ProductErrorCategory;
  retryable?: boolean;
  cause?: unknown;
}

export class ProductError extends Error {
  readonly code: ProductErrorCode;
  readonly category: ProductErrorCategory;
  readonly retryable: boolean;

  constructor(code: ProductErrorCode, message: string, options: ProductErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProductError";
    this.code = code;
    this.category = options.category;
    this.retryable = options.retryable ?? false;
  }

  toData(): ProductErrorData {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export function isProductError(value: unknown): value is ProductError {
  return value instanceof ProductError;
}
