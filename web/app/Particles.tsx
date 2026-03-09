'use client';

import React from 'react';

/**
 * Floating Particles Component
 * 
 * Add this component to your layout.tsx or page.tsx to render
 * beautiful floating particles in the background.
 * 
 * Usage:
 * import { Particles } from './Particles';
 * 
 * // In your layout or page:
 * <Particles />
 */

export function Particles() {
  return (
    <div className="particles-container" aria-hidden="true">
      {/* Primary particles - larger, accent colored */}
      <div className="particle particle--primary" />
      <div className="particle particle--primary" />
      <div className="particle particle--primary" />
      <div className="particle particle--primary" />
      <div className="particle particle--primary" />
      
      {/* Secondary particles - medium, success colored */}
      <div className="particle particle--secondary" />
      <div className="particle particle--secondary" />
      <div className="particle particle--secondary" />
      <div className="particle particle--secondary" />
      <div className="particle particle--secondary" />
      
      {/* Tertiary particles - smaller, info colored */}
      <div className="particle particle--tertiary" />
      <div className="particle particle--tertiary" />
      <div className="particle particle--tertiary" />
      <div className="particle particle--tertiary" />
      <div className="particle particle--tertiary" />
    </div>
  );
}

export default Particles;