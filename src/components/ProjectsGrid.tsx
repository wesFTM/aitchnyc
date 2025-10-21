'use client';

import React from 'react';
import Link from 'next/link';
import projects from '@/data/projects';

export default function ProjectsGrid() {
  return (
    <section id="projects" className="py-20 px-6 md:px-12 bg-black text-white">
      <h2 className="text-3xl md:text-4xl font-bold mb-10 text-center">Recent Projects</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="group block overflow-hidden rounded-lg border border-white/10 hover:border-white transition"
          >
            <video
              src={project.video}
              autoPlay
              loop
              muted
              playsInline
              className="object-cover w-full aspect-video group-hover:scale-105 transition-transform duration-300"
            />
            <div className="p-4 text-white/80 group-hover:text-white">
              <h3 className="text-xl font-semibold">{project.title}</h3>
              <p className="text-sm">{project.role}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
