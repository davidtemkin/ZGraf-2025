# ZGraf / Manic Episode (2025 Web Port)

Modern web port of **Manic Episode**, a stereoscopic 3D tunnel shooter originally written for classic Macintosh in 1991-1992.

## Play Online

**[Play Now](https://davidtemkin.web.app/manic-episode/)**

Requires red/cyan anaglyph 3D glasses for the full stereoscopic effect.

## About

This is a faithful port of the original game to modern web browsers using HTML5 Canvas and JavaScript. The game features:

- Real-time stereoscopic 3D (red/cyan anaglyph)
- Tunnel-based gameplay with enemies, power-ups, and obstacles
- Original sound effects
- Attract mode and multiple difficulty levels

## Controls

- **Mouse**: Aim
- **Click / Space**: Fire
- **W / Up Arrow / 2**: Accelerate forward
- **S / Down Arrow / 1**: Accelerate backward
- **Escape**: Pause

## Running Locally

```bash
cd manic-episode
python3 server.py
# Open http://localhost:8080 in your browser
```

Or use any static file server.

## Project Structure

```
manic-episode/
  index.html      - Main HTML file
  js/             - Game JavaScript modules
  css/            - Stylesheets
  images/         - Game graphics
  sounds/         - Sound effects
```

## See Also

- [ZGraf-1991](https://github.com/dtemkin/ZGraf-1991) - Original Macintosh source code

## License

MIT License - Copyright (c) 1991-2025 David Temkin
