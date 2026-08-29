export function extractApiErrorMessage(err: unknown): string {
  const axErr = err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    axErr.response?.data?.error?.message ||
    axErr.response?.data?.message ||
    axErr.message ||
    "Une erreur est survenue lors de l'enregistrement."
  );
}
