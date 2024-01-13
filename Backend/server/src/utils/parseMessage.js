const parseMessage = (data) => {
  if (data.match(/\bColmap Bundle Adjuster\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "3.2", step: "colmap" },
      message: "Colmap Bundle Adjuster",
    };
  } else if (data.match(/\bColmap Undistorting Images\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "3.3", step: "colmap" },
      message: "Undistorting images",
    };
  } else if (data.match(/Undistorting image \[.*]/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "3.3", step: "colmap" },
      message: data.match(/Undistorting image \[.*]/)[0],
    };
  } else if (data.match(/\bColmap Model Converter\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "3.4", step: "colmap" },
      message: "Colmap Model Converter",
    };
  } else if (data.match(/\bCreate MVS scene\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "4", step: "openMVS" },
      message: "Create MVS scene",
    };
  } else if (data.match(/\bDensify point cloud\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "4.1", step: "openMVS" },
      message: "Densify point cloud",
    };
  } else if (data.match(/\bReconstruct the mesh\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "4.2", step: "openMVS" },
      message: "Reconstruct the mesh",
    };
  } else if (data.match(/\bRefine the mesh\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "4.3", step: "openMVS" },
      message: "Refine the mesh",
    };
  } else if (data.match(/\bTexture the mesh\b/)) {
    return {
      status: "PROCESSING",
      metadata: { stage: "4.4", step: "openMVS" },
      message: "Texture the mesh",
    };
  } else if (data.match(/\bfailed to create sparse model\b/)) {
    console.log("failed to create sparse model");
    return {
      status: "FAILED",
      metadata: { stage: "0", step: "reconstruction" },
      message: "Failed to create sparse reconstruction",
    };
  } else if (
    data.match(/\bpreparing images for dense reconstruction failed\b/)
  ) {
    console.log("preparing images for dense reconstruction failed");
    return {
      status: "FAILED",
      metadata: { stage: "0", step: "reconstruction" },
      message: "Failed to create dense reconstruction",
    };
  }
};

module.exports = { parseMessage };
