const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readFile(relPath) {
  const p = path.resolve(root, relPath);
  return { p, content: fs.readFileSync(p, "utf8") };
}
function saveFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}
function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}
function denormalize(text, hasCRLF) {
  return hasCRLF ? text.replace(/\n/g, "\r\n") : text;
}

// ============ 1. index.ts ============
{
  const { p, content } = readFile("apps/settings/components/index.ts");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldStr = 'export { VersionInfoSection } from "./VersionInfoSection";';
  const newStr =
    'export { AppearanceSection } from "./AppearanceSection";\nexport { VersionInfoSection } from "./VersionInfoSection";';

  if (n.includes(oldStr)) {
    n = n.replace(oldStr, newStr);
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ index.ts");
  } else {
    console.log("✗ index.ts - pattern not found");
    const idx = n.indexOf("VersionInfoSection");
    if (idx >= 0)
      console.log(
        "  Found at",
        idx,
        ":",
        JSON.stringify(n.substring(idx, idx + 60)),
      );
  }
}

// ============ 2. SettingsPanel.tsx ============
{
  const { p, content } = readFile("apps/settings/SettingsPanel.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Add import (including DifyConfigSection comment)
  const oldImport =
    'import {\n\tAudioAsrConfigSection,\n\tAudioConfigSection,\n\tAutomationTasksSection,\n\tAutoTodoDetectionSection,\n\t// DifyConfigSection,\n\tDockDisplayModeSection,\n\tJournalSettingsSection,\n\tLlmConfigSection,\n\tNotificationPermissionSection,\n\tOnboardingSection,\n\tPanelSwitchesSection,\n\tRecorderConfigSection,\n\tSchedulerSection,\n\ttype SettingsCategory,\n\ttype SettingsCategoryId,\n\tSettingsCategoryPanel,\n\tSettingsSearchAction,\n\tSettingsSearchProvider,\n\tSettingsSection,\n\tTavilyConfigSection,\n\tVersionInfoSection,\n} from "./components";';

  const newImport =
    'import {\n\tAppearanceSection,\n\tAudioAsrConfigSection,\n\tAudioConfigSection,\n\tAutomationTasksSection,\n\tAutoTodoDetectionSection,\n\t// DifyConfigSection,\n\tDockDisplayModeSection,\n\tJournalSettingsSection,\n\tLlmConfigSection,\n\tNotificationPermissionSection,\n\tOnboardingSection,\n\tPanelSwitchesSection,\n\tRecorderConfigSection,\n\tSchedulerSection,\n\ttype SettingsCategory,\n\ttype SettingsCategoryId,\n\tSettingsCategoryPanel,\n\tSettingsSearchAction,\n\tSettingsSearchProvider,\n\tSettingsSection,\n\tTavilyConfigSection,\n\tVersionInfoSection,\n} from "./components";';

  let spChanged = false;

  if (n.includes(oldImport)) {
    n = n.replace(oldImport, newImport);
    spChanged = true;
    console.log("  ✓ import added");
  } else {
    console.log("  ✗ SettingsPanel import pattern not found");
    const idx = n.indexOf("AudioAsrConfigSection");
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx - 20, idx + 100)),
      );
  }

  // Add <AppearanceSection /> to workspace case
  const oldCase =
    '\t\t\tcase "workspace":\n\t\t\t\treturn (\n\t\t\t\t\t<>\n\t\t\t\t\t\t<DockDisplayModeSection loading={loading} />\n\t\t\t\t\t\t<PanelSwitchesSection loading={loading} />\n\t\t\t\t\t\t<NotificationPermissionSection loading={loading} />\n\t\t\t\t\t</>\n\t\t\t\t);';

  const newCase =
    '\t\t\tcase "workspace":\n\t\t\t\treturn (\n\t\t\t\t\t<>\n\t\t\t\t\t\t<AppearanceSection />\n\t\t\t\t\t\t<DockDisplayModeSection loading={loading} />\n\t\t\t\t\t\t<PanelSwitchesSection loading={loading} />\n\t\t\t\t\t\t<NotificationPermissionSection loading={loading} />\n\t\t\t\t\t</>\n\t\t\t\t);';

  if (n.includes(oldCase)) {
    n = n.replace(oldCase, newCase);
    spChanged = true;
    console.log("  ✓ workspace case updated");
  } else {
    console.log("  ✗ SettingsPanel workspace case not found");
    const idx = n.indexOf('"workspace"');
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx, idx + 200)),
      );
  }

  if (spChanged) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ SettingsPanel.tsx");
  }
}

// ============ 3. AppHeader.tsx ============
{
  const { p, content } = readFile("components/layout/AppHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let ahChanged = false;

  // Remove imports
  const oldImports =
    'import { LayoutSelector } from "@/components/common/layout/LayoutSelector";\nimport { ThemeStyleSelect } from "@/components/common/theme/ThemeStyleSelect";\nimport { ThemeToggle } from "@/components/common/theme/ThemeToggle";\nimport { LanguageToggle } from "@/components/common/ui/LanguageToggle";\nimport { SettingsToggle } from "@/components/common/ui/SettingsToggle";';

  const newImports =
    'import { SettingsToggle } from "@/components/common/ui/SettingsToggle";';

  if (n.includes(oldImports)) {
    n = n.replace(oldImports, newImports);
    ahChanged = true;
    console.log("  ✓ imports cleaned");
  } else {
    console.log("  ✗ imports pattern not found (AppHeader)");
    const idx = n.indexOf("LayoutSelector");
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx - 20, idx + 100)),
      );
  }

  // Remove JSX buttons (actual indent: 3 tabs for div, 4 tabs for items)
  const oldJSX =
    '\t\t\t<div className="flex items-center gap-2 min-w-0 shrink-0">\n\t\t\t\t<LayoutSelector />\n\t\t\t\t<ThemeStyleSelect />\n\t\t\t\t<ThemeToggle />\n\t\t\t\t<LanguageToggle />\n\t\t\t\t<SettingsToggle />\n\t\t\t</div>';

  const newJSX =
    '\t\t\t<div className="flex items-center gap-2 min-w-0 shrink-0">\n\t\t\t\t<SettingsToggle />\n\t\t\t</div>';

  if (n.includes(oldJSX)) {
    n = n.replace(oldJSX, newJSX);
    ahChanged = true;
    console.log("  ✓ JSX buttons removed");
  } else {
    console.log("  ✗ JSX pattern not found (AppHeader)");
    const idx = n.indexOf("SettingsToggle");
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx - 60, idx + 40)),
      );
  }

  if (ahChanged) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ AppHeader.tsx");
  }
}

// ============ 4. FullscreenHeader.tsx ============
{
  const { p, content } = readFile("components/layout/FullscreenHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let fhChanged = false;

  // Remove imports
  const oldImports =
    'import { LayoutSelector } from "@/components/common/layout/LayoutSelector";\nimport { ThemeStyleSelect } from "@/components/common/theme/ThemeStyleSelect";\nimport { ThemeToggle } from "@/components/common/theme/ThemeToggle";\nimport { LanguageToggle } from "@/components/common/ui/LanguageToggle";\nimport { SettingsToggle } from "@/components/common/ui/SettingsToggle";';

  const newImports =
    'import { SettingsToggle } from "@/components/common/ui/SettingsToggle";';

  if (n.includes(oldImports)) {
    n = n.replace(oldImports, newImports);
    fhChanged = true;
    console.log("  ✓ imports cleaned");
  } else {
    console.log("  ✗ imports pattern not found (Fullscreen)");
    const idx = n.indexOf("LayoutSelector");
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx - 20, idx + 100)),
      );
  }

  // Remove JSX buttons (actual indent: 3 tabs for div, 4 tabs for items)
  const oldJSX =
    '\t\t\t<div className="flex items-center gap-2 shrink-0">\n\t\t\t\t<LayoutSelector />\n\t\t\t\t<ThemeStyleSelect />\n\t\t\t\t<ThemeToggle />\n\t\t\t\t<LanguageToggle />\n\t\t\t\t<SettingsToggle />\n\t\t\t</div>';

  const newJSX =
    '\t\t\t<div className="flex items-center gap-2 shrink-0">\n\t\t\t\t<SettingsToggle />\n\t\t\t</div>';

  if (n.includes(oldJSX)) {
    n = n.replace(oldJSX, newJSX);
    fhChanged = true;
    console.log("  ✓ JSX buttons removed");
  } else {
    console.log("  ✗ JSX pattern not found (Fullscreen)");
    const idx = n.indexOf("SettingsToggle");
    if (idx >= 0)
      console.log(
        "    At",
        idx,
        ":",
        JSON.stringify(n.substring(idx - 60, idx + 40)),
      );
  }

  if (fhChanged) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ FullscreenHeader.tsx");
  }
}

console.log("\n✅ Done");
