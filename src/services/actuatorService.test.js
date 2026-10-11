import { afterEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import actuatorDefault, { getActuatorHealth, getActuatorInfo } from './actuatorService';

describe('actuatorService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should report build info using the package.json version', async () => {
    const info = await getActuatorInfo();

    expect(info.build.version).toBe(packageJson.version);
    expect(info.build.name).toBe('fitz-net-website');
    expect(info.build.group).toBe('org.fitznet');
    expect(info.app.name).toBe('fitz-net-website');
    expect(info.java.version).toBe('N/A (frontend)');
  });

  it('should describe the browser environment in the os section', async () => {
    const info = await getActuatorInfo();

    expect(info.os.arch).toBe('browser');
    expect(info.os.version).toBe(navigator.userAgent);
    expect(info.os.name).toBe(navigator.platform);
  });

  it('should report unknown platform details when there is no navigator', async () => {
    vi.stubGlobal('navigator', undefined);

    const info = await getActuatorInfo();

    expect(info.os).toEqual({ name: 'Unknown', version: 'Unknown', arch: 'Unknown' });
  });

  it('should report the build time as an ISO timestamp', async () => {
    const info = await getActuatorInfo();

    expect(new Date(info.build.time).toISOString()).toBe(info.build.time);
  });

  it('should report the frontend as UP', async () => {
    const health = await getActuatorHealth();

    expect(health.status).toBe('UP');
    expect(health.components.frontend.status).toBe('UP');
    expect(health.components.frontend.details.message).toBe('Frontend application is running');
  });

  it('should expose both functions on the default export', () => {
    expect(actuatorDefault.getActuatorInfo).toBe(getActuatorInfo);
    expect(actuatorDefault.getActuatorHealth).toBe(getActuatorHealth);
  });
});
