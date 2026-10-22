---
id: run-timing-tests-serially
type: learning
title: Run timing tests serially
tags:
  - testing
  - performance
date: 2026-10-21
---
Perf and load tests (tests/perf, tests/load) are flaky next to the parallel default suite; they run alone with npm run test:load (fileParallelism false), with a 2x budget on CI.
