Drop your artwork images here — one file per artwork, named by its number:

  public/art/5.jpg
  public/art/6.png
  public/art/120.webp

Accepted extensions: .jpg, .jpeg, .png, .webp, .gif

The image for artwork #N shows up automatically on the voting cards. After
adding or removing files, the manifest rebuilds itself on the next
`npm run dev` / `npm run build`, or run `npm run scan:art` manually.

(On serverless deployments like Vercel these files are deployed with your
repo — no external image storage needed.)
