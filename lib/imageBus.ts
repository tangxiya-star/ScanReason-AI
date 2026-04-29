"use client";

export type ClientImage = { media: string; data: string };

let getter: (() => ClientImage | null) | null = null;

export function registerImageGetter(fn: (() => ClientImage | null) | null) {
  getter = fn;
}

export function getCurrentImage(): ClientImage | null {
  try {
    return getter ? getter() : null;
  } catch {
    return null;
  }
}
