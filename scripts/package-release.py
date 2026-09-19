"""Build installable release assets. Does not publish or change the source manifest."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "module.json").read_text())
version = manifest["version"]
url = "https://github.com/axon-dystro/Axon-s-Calender"
manifest.update(url=url, manifest=f"{url}/releases/latest/download/module.json",
                download=f"{url}/releases/download/v{version}/axons-calender.zip")
out = root / "dist"
out.mkdir(exist_ok=True)
serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
(out / "module.json").write_text(serialized)
with ZipFile(out / "axons-calender.zip", "w", ZIP_DEFLATED) as archive:
    archive.writestr("module.json", serialized)
    for folder in ("scripts", "styles", "templates", "lang"):
        for file in sorted((root / folder).iterdir()):
            if file.suffix in (".js", ".css", ".hbs", ".json"):
                archive.write(file, file.relative_to(root))
    for name in ("README.md", "CHANGELOG.md", "LICENSE"):
        archive.write(root / name, name)
with ZipFile(out / "axons-calender.zip") as archive:
    assert archive.testzip() is None
    assert json.loads(archive.read("module.json"))["version"] == version
    assert "scripts/main.js" in archive.namelist()
print(f"Built dist/axons-calender.zip and dist/module.json for v{version}; not published.")
