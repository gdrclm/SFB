export function describeFailedImpact(speed: number, strength: number, boostMultiplier: number): string {
  const deficit = Math.max(0, strength - speed);
  const boostedSpeed = speed * boostMultiplier;
  return `Скорость удара ${speed.toFixed(2)} · прочность ${String(strength)}. Не хватило ${(Math.ceil(deficit * 100) / 100).toFixed(2)} ед/с. ` +
    (boostedSpeed >= strength
      ? `На этой скорости один BOOST дал бы ${boostedSpeed.toFixed(2)} ед/с — достаточно для пробития, если есть энергия и BOOST готов.`
      : `Один BOOST дал бы ${boostedSpeed.toFixed(2)} ед/с — всё ещё мало. Набирайте скорость заранее или обходите такую платформу.`);
}
