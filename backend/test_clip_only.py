#!/usr/bin/env python3
"""
Test CLIP model loading without Qdrant initialization
"""
import os
import sys
import logging
import torch
import open_clip

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_clip_model():
    """Test CLIP model loading and basic functionality"""
    
    # Initialize device
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {DEVICE}")
    
    # Check for local model
    local_model_path = os.path.join(os.path.dirname(__file__), "models", "clip-vit-base-patch32")
    model_file = os.path.join(local_model_path, "open_clip_pytorch_model.bin")
    
    if os.path.exists(model_file):
        try:
            logger.info(f"Loading local CLIP model from {model_file}")
            
            # Create model and load local weights
            clip_model, _, clip_preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained=None)
            
            # Load the local weights
            checkpoint = torch.load(model_file, map_location=DEVICE)
            clip_model.load_state_dict(checkpoint)
            
            clip_tokenizer = open_clip.get_tokenizer('ViT-B-32')
            clip_model.to(DEVICE).eval()
            
            logger.info("✅ Local CLIP model loaded successfully!")
            
            # Test text encoding
            test_text = ["a photo of a cat", "a document about business"]
            text_tokens = clip_tokenizer(test_text)
            
            with torch.no_grad():
                text_features = clip_model.encode_text(text_tokens.to(DEVICE))
                logger.info(f"✅ Text encoding test successful! Shape: {text_features.shape}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load local CLIP model: {e}")
            return False
    else:
        logger.error(f"❌ Local model file not found: {model_file}")
        return False

if __name__ == "__main__":
    success = test_clip_model()
    if success:
        print("\n🎉 CLIP model is working correctly!")
        print("The semantic search and image processing features should now work without SSL issues.")
    else:
        print("\n❌ CLIP model test failed.")
        sys.exit(1)
