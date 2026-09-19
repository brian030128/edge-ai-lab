---
title: Same binary, two identical phones, 40% apart
summary: It took three weeks to find out the problem was not the model. It was the desk lamp.
author: chia-ling-wu
tags: measurement, benchmarking, edgebench
---

At the end of July, two test phones of the same model on the same firmware ran the same benchmark and reported median latencies 40% apart. They were bought on the same day; their serial numbers differ by three digits.

We suspected software first, as you do: background processes, scheduler affinity, Android's own power policy. We ruled them out one at a time. The gap stayed.

## Turn everything off at once

The fast way through a problem like this is not to eliminate factors one by one. It is to switch every suspect off at the same time, confirm the problem disappears, and then add them back individually. Our list:

- Airplane mode, all background sync disabled
- CPU and GPU clocks pinned (needs root)
- Fixed screen brightness, auto-brightness off
- A 60-second warm-up before every measurement

With all of it off, the gap shrank to 3%. Adding factors back, it returned at the third one.

## It was the lamp

The difference was where the phones sat. One was on the desk near the window; the other was directly under a desk lamp. After thirty minutes of continuous runs, the case temperature under the lamp was almost 6°C higher and the SoC had started to throttle.

One thermal camera image of each made it obvious. "Same model, same firmware" had never included ambient temperature as a controlled variable.

> If a measurement is meant to be reproducible, the environment is part of the experimental setup, not the background.

## What we changed

`edgebench` now records three things on every run and prints them with the results:

```python
run.record(
    soc_temp_c=device.thermal_zone("soc"),
    clock_mhz=device.cpu_clock(),
    ambient_note=os.environ.get("EDGEBENCH_AMBIENT", "unspecified"),
)
```

The first two are automatic. The third one a human has to type. It sounds primitive, but it forces you to think for one second before pressing enter: where is this device right now.

We also added a check. If the SoC temperature moves more than 5°C within a run, the report is marked `unstable` and stays out of the comparison charts by default. Three weeks of confusion, about ten lines of code.

If you are starting device-side measurements, record the environment from day one rather than going back for it once the numbers stop agreeing.
