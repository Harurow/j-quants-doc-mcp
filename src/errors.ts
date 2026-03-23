import { getExternalLinks } from "./markdown-loader.js";

export function formatValidationError(field: string, message: string) {
  return {
    error: true,
    error_type: "ValidationError",
    message: `入力パラメータ '${field}' のバリデーションエラー: ${message}`,
    details: { field, validation_error: message },
  };
}

export function formatNotFoundError(
  resourceType: string,
  identifier: string,
  suggestion?: string,
) {
  let message = `${resourceType} '${identifier}' が見つかりませんでした。`;
  if (suggestion) message += ` ${suggestion}`;
  return {
    error: true,
    error_type: "NotFoundError",
    message,
    details: { resource_type: resourceType, identifier, suggestion },
  };
}

export function formatInternalError(operation: string, originalError: unknown) {
  const errMsg = originalError instanceof Error ? originalError.message : String(originalError);
  return {
    error: true,
    error_type: "InternalError",
    message: `${operation} 中に内部エラーが発生しました。`,
    details: { operation, original_error: errMsg },
  };
}

export function formatNetworkErrorWithLinks(message: string) {
  const links = getExternalLinks();
  return {
    error: true,
    error_type: "NetworkError",
    message,
    external_links: links,
    instruction:
      `エラーが発生しました。上記のメッセージをユーザーに伝えてください。\n` +
      `また、以下の公式ドキュメントも参照するよう案内してください：\n` +
      `- API仕様書: ${links.spec_docs ?? ""}\n` +
      `- ヘルプページ: ${links.help ?? ""}`,
  };
}

export function formatNotFoundErrorWithLinks(
  resourceType: string,
  identifier: string,
) {
  const links = getExternalLinks();
  return {
    error: true,
    error_type: "NotFoundError",
    message: `${resourceType} '${identifier}' が見つかりませんでした。`,
    external_links: links,
    instruction:
      `指定されたリソースが見つかりませんでした。\n` +
      `以下の公式ドキュメントを参照するようユーザーに案内してください：\n` +
      `- API仕様書: ${links.spec_docs ?? ""}\n` +
      `- ヘルプページ: ${links.help ?? ""}`,
    resource_type: resourceType,
    identifier,
  };
}
