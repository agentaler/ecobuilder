# Ecobuilder landing site — static build + tiny Bun server.
FROM oven/bun:1.3.11-slim AS build
WORKDIR /app
COPY landing/ landing/
RUN bun run landing/build.ts

FROM oven/bun:1.3.11-slim
WORKDIR /app
COPY --from=build /app/landing/dist landing/dist
COPY landing/server.ts landing/server.ts
ENV NODE_ENV=production
EXPOSE 4173
CMD ["bun", "run", "landing/server.ts"]
