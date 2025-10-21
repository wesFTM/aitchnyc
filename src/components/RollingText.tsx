'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const phrases = [
  'Interactive Design',
  'Frontend Development',
  'Next.js',
  'TypeScript',
  'Motion Graphics',
  'Video Editing',
  'Creative Direction',
  'Product Design',
];

export default function RollingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-10 w-full px-4 flex flex-col items-center text-center text-xl sm:text-2xl md:text-3xl font-medium text-white">
      {/* Static text on top */}
      <span className="mb-2">I have experience with</span>

      {/* Animated text below */}
      <div className="relative h-[1.4em] min-w-[12ch]">
        <span className="invisible block">Frontend Development</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={phrases[index]}
            initial={{ opacity: 0, y: '0.4em' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '-0.4em' }}
            transition={{ duration: 0.5 }}
            className="absolute left-0 top-0 w-full bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent"
          >
            {phrases[index]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
