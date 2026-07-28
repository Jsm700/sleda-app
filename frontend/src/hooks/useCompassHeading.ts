// Tilt-compensated compass heading, combining Accelerometer + Magnetometer.
// The simple flat-only formula (magnetometer x/y alone) only works when the
// phone is held perfectly level - it breaks down (up to 180 deg off) as soon
// as the phone tilts away from flat, which is how people actually hold
// phones while walking and looking at the screen. This is the standard
// tilt-compensation approach used by real compass apps.
import { useEffect, useRef, useState } from "react";
import { Accelerometer, Magnetometer } from "expo-sensors";

export function useCompassHeading() {
  const [heading, setHeading] = useState(0);
  const [fieldStrength, setFieldStrength] = useState(0);
  const accel = useRef({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    Accelerometer.setUpdateInterval(150);
    Magnetometer.setUpdateInterval(150);

    const accelSub = Accelerometer.addListener(
      ({ x, y, z }: { x: number; y: number; z: number }) => {
        accel.current = { x, y, z };
      },
    );

    const magSub = Magnetometer.addListener(
      ({ x: mx, y: my, z: mz }: { x: number; y: number; z: number }) => {
        const { x: ax, y: ay, z: az } = accel.current;

        const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));
        const roll = Math.atan2(ay, az);

        const xh = mx * Math.cos(pitch) + mz * Math.sin(pitch);
        const yh =
          mx * Math.sin(roll) * Math.sin(pitch) +
          my * Math.cos(roll) -
          mz * Math.sin(roll) * Math.cos(pitch);

        let deg = Math.atan2(-xh, yh) * (180 / Math.PI);
        deg = deg < 0 ? deg + 360 : deg;
        setHeading(deg);
        setFieldStrength(Math.sqrt(mx * mx + my * my + mz * mz));
      },
    );

    return () => {
      accelSub.remove();
      magSub.remove();
    };
  }, []);

  return { heading, fieldStrength };
}
