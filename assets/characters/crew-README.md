# Station crew workwear

`station-crew-male.glb` and `station-crew-female.glb` are a separate pair of
realistic, clothed crew models for the space-station interior. They use fitted
long-sleeved coveralls with modeled front closure, pockets, seams and cuffs.
The garments are ordinary non-pressurized fabric workwear, with no helmet,
pressure-suit rings, oxygen backpack or EVA equipment. Their finish stays opaque
matte white, consistent with the architectural clay models.

The meshes are built from MakeHuman bodies and system assets plus Elvaerwyn's
`elvs_male_coveralls_1` garment, then fitted, detailed and bound to an independent
anatomical skeleton. They are not a recolor of the office characters. The runtime
uses their own asset pool and applies the station's microgravity poses and daily
work activities. Exact geometry counts and current file hashes are recorded in
[manifest.json](manifest.json).

The MakeHuman components are CC0; Elvaerwyn's garment is CC BY 2.5 Sweden.
Keep the authorship and modification notice in [crew-LICENSE.md](crew-LICENSE.md)
with redistributed models. The office-character MIT notice does not cover these
station files.

## Sources and reconstruction

- MPFB source: https://github.com/makehumancommunity/mpfb2
- MakeHuman system assets:
  https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- Coverall source/author listing:
  https://static.makehumancommunity.org/assets/assetpacks/suits03.html
- Coverall download:
  https://files.makehumancommunity.org/asset_packs/suits03/suits03_cc-by.zip

The development build used `scripts/prepare-station-crew.py` with Blender's
background Python. That maintenance script and its downloaded research inputs
are not included in this production snapshot. The following command records the
original build procedure for maintainers who have those inputs:

```powershell
blender --background --factory-startup `
  --python scripts/prepare-station-crew.py -- `
  --mpfb-source-dir output/character-assets-research/makehuman/source/mpfb2-master/src `
  --system-assets-dir output/character-assets-research/makehuman/system `
  --coverall-dir output/station-crew-research/makehuman/coverall-source/clothes/elvs_male_coveralls_1 `
  --output-dir assets/characters `
  --research-dir output/station-crew-research/makehuman
```

Use equivalent absolute paths when running from another directory. The script
creates male/female body shapes, fits the coverall and system assets, adds actual
garment detail geometry, refines and optimizes surfaces, retains skin weights,
normalizes the coordinate frame and exports GLB. The nominal model height is
1.789 m, with Y up and +Z forward after glTF conversion. The built-in MPFB rig's
`mixamorig:` bone names are compatible with the application's anatomical motion
adapter; no Adobe service or online auto-rigging operation is involved.

## Real astronaut clothing references

The following NASA Image Library photographs were inspected for garment
construction. They show real astronauts in non-pressurized blue flight/work
coveralls. They are official portraits, not evidence that these exact outfits
or shoes were being worn aboard the station at that moment.

- Jessica Watkins, full body, NASA/Bill Stafford:
  https://images.nasa.gov/details/jsc2026e035015_alt
  — continuous coverall, front zipper, waist adjustment, thigh and lower-leg
  pockets, sleeve and ankle fabric folds.
- Luke Delaney, full body, NASA/Bill Stafford:
  https://images.nasa.gov/details/jsc2026e034984_alt
  — male fit and the continuous torso-to-trouser construction.
- Thomas Pesquet, torso detail, NASA/Bill Stafford:
  https://images.nasa.gov/details/jsc2016e010167
  — soft collar, central zipper, chest-pocket entries, sleeve pocket and wrist tab.

The development reference copies and original NASA metadata were retained in
`output/station-crew-research/reference/`, outside this production snapshot. Only the clothing construction informed
the models; the photos are not product textures. White-clay rendering keeps the
shape and depth of these garment details without blue color or insignia. Light
cabin footwear is a design adaptation; the portrait footwear is not an ISS
footwear specification.
