'use client';

import { useEffect } from 'react';
import { ensureSession } from '@/utils/api-client';

let established = false;

export function SessionBootstrap() {
  useEffect(() => {
    if (established) return;
    established = true;
    ensureSession().catch(() => {});
  }, []);
  return null;
}
