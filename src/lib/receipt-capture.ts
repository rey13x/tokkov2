// Get receipt PDF from server (much lighter than image capture)
export async function getReceiptPdf(orderId: string): Promise<Blob> {
  const response = await fetch(`/api/orders/${orderId}/receipt`);
  if (!response.ok) {
    throw new Error("Failed to fetch receipt PDF");
  }
  return response.blob();
}

// Get receipt as lightweight image (fallback, uses simpler approach)
export async function captureReceiptAsImage(orderId: string): Promise<Blob> {
  // Try to get PDF first - it's much lighter and works better
  try {
    return await getReceiptPdf(orderId);
  } catch (pdfError) {
    console.warn("PDF fetch failed, falling back to image capture:", pdfError);
    // Fallback to old image capture if PDF fails
    return captureReceiptAsImageFallback(orderId);
  }
}

// Original image capture as fallback only
async function captureReceiptAsImageFallback(orderId: string): Promise<Blob> {
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
    const response = await fetch(`/api/orders/${orderId}/receipt-image`);
    if (!response.ok) {
      throw new Error("Failed to fetch receipt");
    }
    
    const html = await response.text();
    
    // Write HTML to iframe
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    // Wait for iframe to fully load with more robust checking
    await new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkLoaded = () => {
        attempts++;
        const readyState = (iframeDoc as any).readyState;
        const bodyExists = iframeDoc.body && iframeDoc.body.children.length > 0;
        
        if ((readyState === "complete" || readyState === "interactive") && bodyExists) {
          resolve(null);
        } else if (attempts < maxAttempts) {
          setTimeout(checkLoaded, 100);
        } else {
          resolve(null); // Timeout but continue anyway
        }
      };
      
      checkLoaded();
    });
    
    // Wait for images, fonts and styles to fully render
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Get the receipt container from iframe
    const receiptContainer = iframeDoc.querySelector(".receipt");
    if (!receiptContainer) {
      throw new Error("Receipt container not found - struk HTML may not have loaded correctly");
    }
    
    // Capture iframe content using the receipt container for better sizing
    const canvas = await html2canvas(receiptContainer as HTMLElement, {
      scale: 1,
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

export async function uploadReceiptImage(
  orderId: string,
  blob: Blob
): Promise<string> {
  // Create form data
  const formData = new FormData();
  
  // Determine filename based on blob type
  const filename = blob.type === "application/pdf" 
    ? `receipt-${orderId}.pdf`
    : `receipt-${orderId}.jpg`;
  
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
