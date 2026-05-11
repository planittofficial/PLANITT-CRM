import crypto from "crypto";

function parseCloudinaryUrl(cloudinaryUrl) {
  if (!cloudinaryUrl) {
    throw new Error("CLOUDINARY_URL is not configured");
  }

  let parsed;
  try {
    parsed = new URL(cloudinaryUrl);
  } catch (_error) {
    throw new Error("CLOUDINARY_URL is invalid");
  }

  if (parsed.protocol !== "cloudinary:") {
    throw new Error("CLOUDINARY_URL must start with cloudinary://");
  }

  const cloudName = parsed.hostname;
  const apiKey = decodeURIComponent(parsed.username || "");
  const apiSecret = decodeURIComponent(parsed.password || "");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_URL is missing cloud name, api key, or api secret");
  }

  return { cloudName, apiKey, apiSecret };
}

function signParams(params, apiSecret) {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${paramString}${apiSecret}`).digest("hex");
}

export async function uploadChatAssetToCloudinary(file, options = {}) {
  const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl(process.env.CLOUDINARY_URL);

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = options.folder || "planitt-crm/chat";
  const publicId = options.publicId;
  const resourceType = options.resourceType || "auto";

  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const signature = signParams(paramsToSign, apiSecret);
  const form = new FormData();
  form.append("file", new Blob([file.buffer]), file.originalname);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Cloudinary upload failed";
    throw new Error(message);
  }

  return payload;
}

function getCloudinaryConfig() {
  return parseCloudinaryUrl(process.env.CLOUDINARY_URL);
}

function extractPublicIdFromCloudinaryUrl(attachmentUrl) {
  if (!attachmentUrl) {
    return null;
  }

  try {
    const parsed = new URL(attachmentUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.findIndex((segment) => segment === "upload");
    if (uploadIndex === -1) {
      return null;
    }

    const afterUpload = segments.slice(uploadIndex + 1);
    if (!afterUpload.length) {
      return null;
    }

    const withoutVersion = /^v\d+$/.test(afterUpload[0]) ? afterUpload.slice(1) : afterUpload;
    if (!withoutVersion.length) {
      return null;
    }

    const joined = withoutVersion.join("/");
    const dotIndex = joined.lastIndexOf(".");
    return dotIndex > 0 ? joined.slice(0, dotIndex) : joined;
  } catch (_error) {
    return null;
  }
}

async function destroyAssetByPublicId(publicId, resourceType = "image") {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const paramsToSign = {
    public_id: publicId,
    timestamp,
  };
  const signature = signParams(paramsToSign, apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Cloudinary destroy failed";
    throw new Error(message);
  }
  return payload;
}

export async function deleteChatAssetFromCloudinaryByUrl(attachmentUrl, mimeType) {
  const publicId = extractPublicIdFromCloudinaryUrl(attachmentUrl);
  if (!publicId) {
    return { deleted: false, reason: "public_id_not_found" };
  }

  const resourceTypes = mimeType?.startsWith("video/") ? ["video"] : ["image", "raw"];
  for (const resourceType of resourceTypes) {
    const result = await destroyAssetByPublicId(publicId, resourceType);
    if (result?.result === "ok") {
      return { deleted: true, publicId, resourceType };
    }
  }

  return { deleted: false, publicId, reason: "not_found" };
}
