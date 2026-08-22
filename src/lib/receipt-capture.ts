export async function captureReceiptAsImage(orderId: string, historyCertificate = false): Promise<Blob> {
  return captureReceiptAsImageFallback(orderId, historyCertificate);
}

// Original image capture as fallback only
async function captureReceiptAsImageFallback(orderId: string, historyCertificate: boolean): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;

  // Create a temporary iframe to load the receipt
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "520px";
  iframe.style.height = "auto";
  iframe.style.border = "none";
  iframe.style.zIndex = "-9999";
  
  try {
    // Append iframe to body
    document.body.appendChild(iframe);
    
    // Get the iframe document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Could not access iframe document");
    }
    
    // Fetch receipt HTML
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receiptline${historyCertificate ? "?history=1" : ""}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch receipt");
    }
    
    const html = await response.text();
    
    // Write HTML to iframe
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    await new Promise<void>((resolve) => {
      if (iframeDoc.readyState === "complete" || iframeDoc.readyState === "interactive") {
        resolve();
        return;
      }
      iframe.addEventListener("load", () => resolve(), { once: true });
      setTimeout(resolve, 1500);
    });
    
    // Wait for images, fonts and styles to fully render
    const images = Array.from(iframeDoc.images);
    await Promise.all(images.map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })));
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Get the receipt container from iframe
    const receiptContainer = iframeDoc.querySelector(".receipt");
    if (!receiptContainer) {
      throw new Error("Receipt container not found - struk HTML may not have loaded correctly");
    }
    
    // Capture iframe content using the receipt container for better sizing
    const canvas = await html2canvas(receiptContainer as HTMLElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: true,
      proxy: undefined,
      windowHeight: (receiptContainer as HTMLElement).scrollHeight,
      windowWidth: 520,
    });
    
    // Convert to blob with compression
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob from canvas"));
          } else {
            resolve(blob);
          }
        },
        "image/jpeg",
        0.9
      );
    });
  } finally {
    // Clean up
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

export async function createPdfFromJpeg(jpeg: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const imageUrl = URL.createObjectURL(jpeg);
  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Gagal membaca gambar sertifikat."));
    });
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im 4 0 R >> >> /Contents 5 0 R >> endobj\n`,
      `4 0 obj << /Type /XObject /Subtype /Image /Width ${image.naturalWidth} /Height ${image.naturalHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
      "",
      "endstream\nendobj\n",
    ];
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im Do\nQ\n`;
    objects[4] = `5 0 obj << /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`;
    const encoder = new TextEncoder();
    const header = encoder.encode("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
    const chunks: Uint8Array[] = [header];
    const offsets = [0];
    let length = header.length;
    const pushText = (text: string) => {
      const chunk = encoder.encode(text);
      offsets.push(length);
      chunks.push(chunk);
      length += chunk.length;
    };
    pushText(objects[0]); pushText(objects[1]); pushText(objects[2]);
    const imageHeader = encoder.encode(objects[3]);
    offsets.push(length); chunks.push(imageHeader); length += imageHeader.length;
    chunks.push(bytes); length += bytes.length;
    pushText(objects[5]);
    const xrefOffset = length;
    let xref = `xref\n0 6\n0000000000 65535 f \n`;
    for (let index = 1; index <= 5; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    xref += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    pushText(xref);
    return new Blob(chunks as BlobPart[], { type: "application/pdf" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function uploadReceiptImage(
  orderId: string,
  blob: Blob
): Promise<string> {
  // Create form data
  const formData = new FormData();
  
  // Determine filename based on blob type
  const filename = blob.type === "application/pdf" 
    ? `tokkomarketplace-struk-${orderId}.pdf`
    : `tokkomarketplace-struk-${orderId}.jpg`;
  
  formData.append("image", blob, filename);
  
  // Upload to endpoint
  const response = await fetch(`/api/orders/${orderId}/upload-receipt-image`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error("Failed to upload receipt image");
  }
  
  const data = (await response.json()) as { imageUrl: string };
  return data.imageUrl;
}

export async function captureConfirmationReceiptAsImage(
  orderId: string,
  notes: string,
  receiptImageUrl: string
): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;

  // Create a temporary iframe to load the confirmation receipt
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "600px";
  iframe.style.height = "auto";
  iframe.style.border = "none";
  iframe.style.zIndex = "-9999";
  
  try {
    // Append iframe to body
    document.body.appendChild(iframe);
    
    // Get the iframe document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Could not access iframe document");
    }
    
    // Fetch confirmation receipt HTML from endpoint
    const response = await fetch(`/api/orders/${orderId}/confirmation-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, receiptImageUrl }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch confirmation receipt");
    }
    
    const html = await response.text();
    
    // Write HTML to iframe
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    // Wait for iframe to load
    await new Promise((resolve) => {
      const checkLoaded = () => {
        if (iframeDoc.readyState === "complete") {
          resolve(null);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      setTimeout(checkLoaded, 100);
    });
    
    // Wait for images and fonts to load
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Capture iframe content
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 1,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: true,
      proxy: undefined,
    });
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob from canvas"));
          } else {
            resolve(blob);
          }
        },
        "image/jpeg",
        0.7
      );
    });
  } finally {
    // Clean up
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
