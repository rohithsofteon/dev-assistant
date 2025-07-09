#!/usr/bin/env python3
"""
Download CLIP model files to avoid SSL issues
"""
import os
import requests
import logging
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_file(url, local_path):
    """Download a file from URL to local path"""
    try:
        logger.info(f"Downloading {url} to {local_path}")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Download with requests
        response = requests.get(url, stream=True, verify=False)  # SSL verification disabled
        response.raise_for_status()
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Successfully downloaded {local_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        return False

def main():
    # Base directory for the model
    model_dir = os.path.join(os.path.dirname(__file__), "models", "clip-vit-base-patch32")
    
    # Files to download (these are the essential CLIP ViT-B/32 files)
    files_to_download = {
        "https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K/resolve/main/open_clip_pytorch_model.bin": "open_clip_pytorch_model.bin",
        "https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K/resolve/main/config.json": "config.json",
    }
    
    logger.info(f"Downloading CLIP model files to {model_dir}")
    
    success_count = 0
    for url, filename in files_to_download.items():
        local_path = os.path.join(model_dir, filename)
        if download_file(url, local_path):
            success_count += 1
    
    logger.info(f"Downloaded {success_count}/{len(files_to_download)} files successfully")
    
    if success_count == len(files_to_download):
        logger.info("All model files downloaded successfully!")
        logger.info(f"Model is ready at: {model_dir}")
    else:
        logger.warning("Some files failed to download. You may need to download them manually.")

if __name__ == "__main__":
    main()
