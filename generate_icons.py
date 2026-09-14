import os
from PIL import Image, ImageDraw

icons_dir = "/Users/ics/Repos/icasadosar/isquad-video-downloader-extension/icons"
os.makedirs(icons_dir, exist_ok=True)

sizes = [16, 48, 128]

for size in sizes:
    img = Image.new("RGBA", (size, size), (24, 26, 32, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw dark rounded background
    margin = max(1, size // 16)
    draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=max(2, size // 5), fill=(24, 26, 32, 255), outline=(61, 245, 158, 255), width=max(1, size // 16))
    
    # Draw play triangle symbol
    pad = size // 3.2
    points = [
        (pad * 1.1, pad),
        (size - pad * 0.9, size / 2),
        (pad * 1.1, size - pad)
    ]
    draw.polygon(points, fill=(61, 245, 158, 255))
    
    img.save(os.path.join(icons_dir, f"icon{size}.png"))

print("Icons generated successfully!")
