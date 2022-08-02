import manifest from "./manifest.gen.ts";
import { start } from "../src/server.ts";

start({ ...manifest, htmlLang: "en" });
