import { Cache } from "@raycast/api";
import { TerraformElement } from "./terraform";

const CACHE_KEY = "chroju-terraform-docs-recent-views";
const CACHE_MAX_LENGTH = 10;
const cache = new Cache();

function setCache(items: TerraformElement[]) {
  cache.set(CACHE_KEY, JSON.stringify(items));
}

export function GetRecentViews() {
  const cached = cache.get(CACHE_KEY);
  return JSON.parse(cached ?? "[]") as TerraformElement[];
}

export function AddRecentView(item: TerraformElement) {
  const recentViews = GetRecentViews();
  const newRecentViews = recentViews.filter((view) => view.name !== item.name);
  newRecentViews.unshift(item);
  if (newRecentViews.length > CACHE_MAX_LENGTH) {
    newRecentViews.pop();
  }
  setCache(newRecentViews);
}
