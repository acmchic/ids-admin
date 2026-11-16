import fs from "fs";
import path from "path";

export function campaignArtisanCommand(args: string[]) {
  const container = process.env.CAMPAIGN_DOCKER_CONTAINER?.trim();
  if (container) {
    const appDir = process.env.CAMPAIGN_DOCKER_WORKDIR || "/home/production/order";
    return {
      file: "docker",
      args: ["exec", "-w", appDir, container, "php", "artisan", ...args],
    };
  }

  const candidates = [
    process.env.CAMPAIGN_ARTISAN_PATH,
    path.resolve(process.cwd(), "..", "..", "order", "artisan"),
    path.resolve(process.cwd(), "..", "..", "orders", "artisan"),
    "/home/production/order/artisan",
    "/home/production/orders/artisan",
  ].filter((candidate): candidate is string => Boolean(candidate));

  const artisan = candidates.find((candidate) => fs.existsSync(candidate));
  if (!artisan) {
    throw new Error(`Unable to locate Laravel artisan. Tried: ${candidates.join(", ")}`);
  }

  return { file: "php", args: [artisan, ...args] };
}
