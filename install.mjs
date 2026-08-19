#!/usr/bin/env node
import { runCli } from './src/install.mjs';

process.exitCode = runCli();
