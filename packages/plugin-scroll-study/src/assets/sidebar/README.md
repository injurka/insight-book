# Sidebar artwork

Generated with the built-in image_gen tool. Reference: user supplied Chinese fantasy RPG inventory panel.

## parchment-panel.webp

Use case: stylized-concept. Asset type: production game UI background, portrait 2:3. Create an EMPTY ancient Chinese fantasy RPG inventory panel in the warm amber parchment, carved dark wood and antique gold style of the attached reference. Full rectangular frame entirely inside canvas with very small outer margin, straight front view, intricately carved restrained bronze corners. Interior aged golden parchment; upper 65 percent almost blank and softly textured for live UI controls. Bottom 30 percent painted Chinese ink mountains, winding golden clouds and a delicate burnt orange plum blossom branch. Low contrast art, readable dark foreground text. NO text, NO symbols, NO buttons, NO cards, NO interface content, NO watermark. This is only the empty panel background. Reference image is style reference, not edit target.

## parchment-tile.webp

Use case: stylized-concept. Asset type: reusable square game UI tile background. An EMPTY square ivory honey parchment tablet for ancient Chinese fantasy RPG, matching antique amber parchment and dark carved wood inventory panel. Straight orthographic front view, tile fills entire canvas edge to edge, thin double embossed antique gold bevel frame, subtly clipped rounded corners with delicate Chinese filigree corner engravings. Very light warm cream paper center entirely blank, even illumination, restrained fine paper texture, readable for dark Chinese glyph placed later by code. NO glyph, NO text, NO objects, NO shadow outside tile, NO watermark. One single tile, not a sheet or mockup.

## Delivery

## Separate layers

The active frame is now `lotus-frame.webp`, a lossless copy of the supplied transparent `exec-28446aca-5ab5-4af1-a9bd-d97e7a1a2444.png`. `game-panel-frame.vue` samples the atlas via SVG viewports: four fixed 40px corners, four repeating 40px rail tiles, and four fixed ornaments. No whole-frame stretching or border-image is used. The sidebar and research board share this component. The old `bg_white_edges.png` is no longer referenced by the board; parchment is a separate layer.

Current frame: `pixel-wood-frame.webp`, generated with built-in image_gen using `bg_white_edges.png` as style reference. Lossless WebP preserves the pixel artwork and alpha. The previous `wood-frame.webp` is retained but no longer used.

Prompt: Transparent pixel art game UI frame matching the reference in dark brown layered wooden rails, chunky pixels, angular Chinese meander corners and restrained copper tones. Four corner ornaments only; middle rails plain and continuous for nine-slice resizing; no central lotus ornaments, parchment, inner backdrop, glow or glossy gold filigree.

The panel now uses `parchment-art.webp` as a proportional cover background and `wood-frame.webp` as a nine-slice border. The frame has a transparent opening and contains no parchment. Both were edited using the built-in image_gen tool with the original panel as reference.

Frame prompt: Extract only the dark wooden outer frame and bronze corner carvings; preserve the portrait canvas and proportions; remove all parchment and interior artwork to transparency; retain straight rails suitable for CSS nine-slice borders.

Background prompt: Remove the entire wooden frame and corner ornaments; extend the amber parchment illustration edge to edge; preserve clouds, mountains and the plum branch; no borders, frame shadows, text or controls.

Panel: 1024 × 1536 WebP. Tile: 256 × 256 WebP. Generated PNG originals converted with ImageMagick for web delivery. All labels, glyphs, controls and selected states are rendered by Vue/CSS. The tile is also used as a sliced border for the search field and info panel to preserve corner proportions.
