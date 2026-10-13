import { useState } from 'react';
export function usePageFlag(_name: string, initial: boolean) { return useState(initial); }
