export function computeDerivedExpiry(credential) {
  if (credential.expiresAt) return credential.expiresAt;
  const days = Number.isFinite(credential.validityDays) ? credential.validityDays : null;
  if (!days || days <= 0) return null;

  const anchor = credential.rotatedAt ?? credential.createdAt;
  if (!anchor) return null;

  return new Date(new Date(anchor).getTime() + days * 24 * 60 * 60 * 1000);
}

export function computeCredentialStatus(expiresAt) {
  if (!expiresAt) return { status: "UNKNOWN", daysLeft: null };
  const now = Date.now();
  const diffMs = new Date(expiresAt).getTime() - now;
  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) return { status: "EXPIRED", daysLeft };
  if (daysLeft <= 14) return { status: "EXPIRING_SOON", daysLeft };
  return { status: "VALID", daysLeft };
}

export function mapCredentialExpiry(row) {
  const derivedExpiresAt = computeDerivedExpiry(row);
  const { status, daysLeft } = computeCredentialStatus(derivedExpiresAt);
  return {
    ...row,
    derivedExpiresAt,
    status,
    daysLeft,
  };
}
