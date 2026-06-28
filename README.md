 # Project: OverGlass 

## Introduction

OverGlass  is a comprehensive application designed to process 
real-time video streams from various sources and perform advanced data 
analysis. The project has been developed by Joshua Giles and is intended 
for real-world implementations requiring high-performance data ingestion, 
processing, and analysis.

## Project Overview

OverGlass is built with a modular architecture that allows easy 
integration of different connectors for handling various video stream 
sources, such as RTSP streams and custom APIs. The application processes 
the received video data in real-time and performs analytics on it using 
state-of-the-art machine learning algorithms.

## Key Features

1. Real-time data ingestion via multiple connectors (RTSP streams, APIs)
2. Advanced machine learning algorithms for video analysis
3. Modular architecture allowing easy integration of new connectors and 
analytical modules
4. User-friendly interface for monitoring and managing connected devices 
and ongoing analyses
5. Scalable design to support high-volume data processing and real-time 
analytics

## Getting Started

To get started with OverGlass , follow these steps:

1. Install the required dependencies by --> npm run build
--you get... 
> overglass@2.0.0 build
> tsc -b && vite build
vite v5.4.21 building for production...
✓ 3857 modules transformed.
---------- next run  
-- npm run dev:all
--or   dev
    vite
  server
    node server/index.cjs
  dev:all
    concurrently "npm run dev" "npm run server"
  build
    tsc -b && vite build
  preview
    vite preview
------- 
2. Configure the connectors by providing appropriate credentials and 
configurations for your video stream sources in the `config.ini` file.
3. Run the application using the provided script (e.g., `run.sh`).
4. Access the user interface through a web browser at 
`http://localhost:3000
