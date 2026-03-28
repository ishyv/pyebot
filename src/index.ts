async function bootstrap(): Promise<void> {
  console.log("[bootstrap] tx-v2 starting...");
}

bootstrap().catch((err) => {
  console.error("[bootstrap] Fatal:", err);
  process.exit(1);
});
