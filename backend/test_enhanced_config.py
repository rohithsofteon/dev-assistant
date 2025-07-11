#!/usr/bin/env python3
"""
Test script to verify the enhanced configuration parameters work correctly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from semantic_indexing import _build_system_prompt

def test_enhanced_config():
    """Test the enhanced configuration parameters"""
    
    print("Testing Enhanced Configuration Parameters")
    print("=" * 50)
    
    # Test 1: Default configuration
    print("\n1. Testing Default Configuration:")
    default_config = {
        'response_mode': 'concise',
        'show_source': 'Yes',
        'chat_persona': 'Friendly',
    }
    prompt = _build_system_prompt(default_config)
    print("Default config prompt:")
    print(prompt)
    
    # Test 2: Full configuration with new parameters
    print("\n2. Testing Full Configuration with New Parameters:")
    full_config = {
        'response_mode': 'detailed',
        'show_source': 'Yes',
        'chat_persona': 'Professional',
        'explanation_level': 'expert',
        'language_tone': 'formal',
        'step_by_step_mode': 'On',
        'follow_up_suggestions': 'Enabled',
    }
    prompt = _build_system_prompt(full_config)
    print("Full config prompt:")
    print(prompt)
    
    # Test 3: Beginner-friendly configuration
    print("\n3. Testing Beginner-Friendly Configuration:")
    beginner_config = {
        'chat_persona': 'Friendly',
        'explanation_level': 'beginner',
        'language_tone': 'casual',
        'step_by_step_mode': 'On',
        'follow_up_suggestions': 'Enabled',
    }
    prompt = _build_system_prompt(beginner_config)
    print("Beginner config prompt:")
    print(prompt)
    
    # Test 4: Expert configuration
    print("\n4. Testing Expert Configuration:")
    expert_config = {
        'chat_persona': 'Professional',
        'explanation_level': 'expert',
        'language_tone': 'formal',
        'step_by_step_mode': 'Off',
        'follow_up_suggestions': 'Disabled',
    }
    prompt = _build_system_prompt(expert_config)
    print("Expert config prompt:")
    print(prompt)
    
    print("\n" + "=" * 50)
    print("All tests completed successfully!")

if __name__ == "__main__":
    test_enhanced_config()
