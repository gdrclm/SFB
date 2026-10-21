interface ScanBall { readonly position: { x: number; y: number }; readonly fallSpeed: number }
interface ScanPlatform {
  readonly isActive: boolean; readonly strength: number; readonly width: number;
  readonly mesh: { position: { x: number; y: number } }; readonly size: { height: number };
}
export function scannerDanger(ball: ScanBall, platform: ScanPlatform, radius: number, range: number): boolean {
  if (range <= 0 || !platform.isActive || platform.strength <= ball.fallSpeed || platform.mesh.position.y > ball.position.y) return false;
  const dx = Math.max(0, Math.abs(platform.mesh.position.x - ball.position.x) - platform.width / 2 - radius);
  const dy = Math.max(0, ball.position.y - radius - platform.mesh.position.y - platform.size.height / 2);
  return Math.hypot(dx, dy) <= range;
}
