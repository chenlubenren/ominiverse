# Realistic clay characters

Four local, rigged characters share a matte clay finish, orange (`#f28c36`) by
default in the app, with any explicitly saved custom color retained. The two office
characters wear everyday clothes; the separate male/female station crew wear
intravehicular work coveralls with raised zipper, pocket, seam and cuff geometry.
The source GLBs retain a neutral white material for reuse. Station models have
their own asset pool and independent skeletons for floating,
work, inspection, conversation, meals and rest.

The office files `clay-male.glb` and `clay-female.glb` are from the
**Microsoft Rocketbox Avatar Library**.
The complete avatar library is MIT-licensed, not only its support scripts. The
upstream README explicitly states: “The library of avatars is now released under
MIT License.” Copyright (c) 2020 Microsoft. See [LICENSE.md](LICENSE.md).

Sources: Male_Adult_02 (sweater and trousers), Female_Adult_01 (shirt and jeans).
Upstream: https://github.com/microsoft/Microsoft-Rocketbox
Pinned source commit: 0943055db6ec570bcef9f2c8b41c9e5467c808f9

The original highest-detail authored anatomy, clothing, hands, face, UVs and 80-bone
skin are preserved. One Catmull-Clark pass smooths the original surface. Body/head
normal maps preserve clothing seams and facial detail under a matte white material.
Hair and eyelash silhouettes use the original coverage mask; their exported RGB
channels contain only grayscale coverage for use as an alpha map.

See manifest.json for triangle counts, file hashes and original download URLs.
The development build used Blender and `scripts/prepare-clay-characters.py`;
that maintenance script and its source inputs are not included in this production
snapshot. To reconstruct that build, the source folder must
contain the two original FBX files and body/head normal and opacity TGA textures in
their upstream Export/ and Textures/ directories, plus Rocketbox-LICENSE.md.
The station files `station-crew-male.glb` and `station-crew-female.glb` combine
MakeHuman CC0 bodies and system assets with **Elvaerwyn's
elvs_male_coveralls_1**, licensed CC-BY 2.5 Sweden. The MIT license above applies
only to the Rocketbox office files. See [crew source and build notes](crew-README.md)
and [crew attribution and licenses](crew-LICENSE.md) for station sources,
modifications and official astronaut flight-suit photo references.

No cloud generation or paid service is used.
