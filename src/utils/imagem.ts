/**
 * Redimensiona e comprime uma imagem no navegador (canvas), recortando pro
 * quadrado central — usado pro avatar da conta. Sem isso, uma foto de
 * celular (3-5 MB) iria inteira pro metadata do usuário no Supabase, que é
 * pensado pra pouca coisa, não pra fotos.
 */
export async function prepararAvatarComoDataUrl(arquivo: File, tamanho = 160, qualidade = 0.75): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (JPEG, PNG, WEBP...).');
  }

  const bitmap = await criarBitmap(arquivo);
  try {
    const lado = Math.min(bitmap.width, bitmap.height);
    const origemX = (bitmap.width - lado) / 2;
    const origemY = (bitmap.height - lado) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');

    ctx.drawImage(bitmap, origemX, origemY, lado, lado, 0, 0, tamanho, tamanho);
    return canvas.toDataURL('image/jpeg', qualidade);
  } finally {
    bitmap.close?.();
  }
}

async function criarBitmap(arquivo: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) return createImageBitmap(arquivo);

  // Fallback pra navegadores sem createImageBitmap: carrega via <img> e
  // desenha num canvas intermediário só pra extrair as dimensões/pixels.
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    return canvas as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}
