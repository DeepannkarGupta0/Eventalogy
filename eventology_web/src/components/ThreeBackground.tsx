"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 28;

    // 3. Renderer setup with alpha transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.8);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xd4af37, 3, 60);
    pointLight1.position.set(15, 12, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffb800, 2, 60);
    pointLight2.position.set(-15, -10, 8);
    scene.add(pointLight2);

    // 5. 3D Elements: Golden Celestial Rings (Architectural Celebration Geometry)
    const ringGroup = new THREE.Group();

    // Main Torus Ring 1
    const geometry1 = new THREE.TorusGeometry(10, 0.18, 16, 100);
    const material1 = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x443000,
      emissiveIntensity: 0.3,
    });
    const ring1 = new THREE.Mesh(geometry1, material1);
    ring1.rotation.x = Math.PI / 3;
    ringGroup.add(ring1);

    // Inner Ring 2
    const geometry2 = new THREE.TorusGeometry(7.5, 0.12, 16, 80);
    const material2 = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x553d00,
      emissiveIntensity: 0.4,
    });
    const ring2 = new THREE.Mesh(geometry2, material2);
    ring2.rotation.y = Math.PI / 4;
    ringGroup.add(ring2);

    // Outer Ring 3
    const geometry3 = new THREE.TorusGeometry(13, 0.08, 16, 120);
    const material3 = new THREE.MeshStandardMaterial({
      color: 0xaa820a,
      metalness: 0.8,
      roughness: 0.3,
    });
    const ring3 = new THREE.Mesh(geometry3, material3);
    ring3.rotation.x = -Math.PI / 6;
    ring3.rotation.y = Math.PI / 6;
    ringGroup.add(ring3);

    scene.add(ringGroup);

    // 6. Floating Celebration Stardust / Particle Swarm
    const particleCount = 280;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      scales[i] = Math.random() * 0.3 + 0.1;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffe899,
      size: 0.35,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 7. Mouse & Scroll Interaction Tracking
    let targetX = 0;
    let targetY = 0;
    let scrollY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleScroll = () => {
      scrollY = window.scrollY;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle natural ring floating
      ringGroup.rotation.y = elapsedTime * 0.15 + targetX * 0.4;
      ringGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.2 + targetY * 0.3;

      // Scroll-driven vertical drift & rotation
      const scrollFactor = scrollY * 0.002;
      ringGroup.position.y = -scrollFactor * 3;
      ringGroup.rotation.z = scrollFactor * 0.8;

      // Subtle particle drift
      particles.rotation.y = elapsedTime * 0.04;
      particles.rotation.x = Math.sin(elapsedTime * 0.03) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Cleanup on unmount
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      geometry1.dispose();
      material1.dispose();
      geometry2.dispose();
      material2.dispose();
      geometry3.dispose();
      material3.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-60 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
