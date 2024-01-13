#!/usr/bin/python3
"""
This script is for an easy use of Colmap and OpenHVS

Photogrammetry reconstruction with these steps:

0. Colmap Feature Extraction    colmap feature_extractor
1. Colmap Exhaustive Matcher    colmap exhaustive_matcher
2. Colmap Mapper                colmap mapper
3. Colmap Bundle Adjuster       colmap bundle_adjuster
4. Colmap Undistorting Images   colmap image_undistorter
5. Colmap Model Converter       colmap model_converter
6. Create MS scene              InterfaceCOLMAP
7. Densify point-cloud          DensifyPointCloud
8. Reconstruct the mesh         Reconstructlesh
9. Refine the mesh              RefineMesh
10. Texture the mesh            TextureMesh
11. Estimate disparity-maps     DensifyPointcloud
12. Fuse disparity-maps         DensifyPointCloud

positional arguments:
    input_dir               the directory wich contains the pictures set.
    output_dir              the directory wich will contain the resulting files.
    camera_model            camera model for COLMAP feature extraction : SIMPLE_PINHOLE, PINHOLE, SIMPLE_RADIAL, RADIAL, OPENCU, FULL_OPENCY, SINPLE_RADIAL_FISHEYE, RADIAL_FISHEYE, OPENCV_FISHEYE, FOV, THIN_ PRISM_FISMEYE
    
optional arguments:
    -h, —help                   show this help message and exit
    --steps STEPS [STEPS ...]   steps to process
    -preset PRESET              steps list preset in
                                SEQUENTIAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                                FULL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                                NOBA = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]
                                default : NOBA
    --colored points            If the colors for vertex points should be extracted (1)
    --empty_color               Color for fill-in texture (0 - black)
    
Passthrough:
    Option to be passed to command lines (remove - in front of option names)
    e.g. —1 p ULTRA to use the ULTRA preset in openMVE_main_ComputeFeatures
"""

import os
import subprocess
import sys
import argparse

DEBUG = False

if sys.platform.startswith("win"):
    PATH_DELIM = ";"
    FOLDER_DELIM = "\\"
else:
    PATH_DELIM = ":"
    FOLDER_DELIM = "/"

# add this script's directory to PATH
os.environ["PATH"] += PATH_DELIM + os.path.dirname(os.path.abspath(__file__))

# add current directory to PATH
os.environ["PATH"] += PATH_DELIM + os.getcwd()


def whereis(afile):
    """
    return directory in which afile is, None if not found. Look in PATH
    """
    if sys.platform.startswith("win"):
        cmd = "where"
    else:
        cmd = "which"
    try:
        ret = subprocess.run(
            [cmd, afile], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True
        )
        return os.path.split(ret.stdout.decode())[0]
    except subprocess.CalledProcessError:
        return None


def find(afile):
    """
    As whereis look only for executable on linux, this find look for all file type
    """
    for d in os.environ["PATH"].split(PATH_DELIM):
        if os.path.isfile(os.path.join(d, afile)):
            return d
    return None


# Try to find Colmap and openMVS binaries in PATH
COLMAP_BIN = whereis("colmap")
OPENMVS_BIN = whereis("ReconstructMesh")

# if not COLMAP_BIN:
#     COLMAP_BIN = input("COLMAP binary folder?\n")
# if not OPENMVS_BIN:
#     OPENMVS_BIN = input("openMVS binary folder?\n")

COLMAP_BIN = os.path.join(COLMAP_BIN, "colmap")
if sys.platform.startswith("win"):
    COLMAP_BIN += ".bat"

if not OPENMVS_BIN:
    OPENMVS_BIN = "/home/openMVS/openMVS_build/bin/"


PRESET = {
    "SEQUENTIAL": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "FULL": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "MOBA": [0, 1, 2, 4, 5, 6, 7, 8, 9, 10],
}
PRESET_DEFAULT = "NOBA"

# HELPERS for terminal colors
BLACK, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE = range(8)
NO_EFFECT, BOLD, UNDERLINE, BLINK, INVERSE, HIDDEN = (0, 1, 4, 5, 7, 8)


# from Python cookbook, #475186
def has_colours(stream):
    """
    Return stream colours capability
    """
    if not hasattr(stream, "isatty"):
        return False
    if not stream.isatty():
        return False  # auto color only on TTYs
    try:
        import curses

        curses.setupterm()
        return curses.tigetnum("colors") > 2
    except Exception:
        # guess false in case of error
        return False


HAS_COLOURS = has_colours(sys.stdout)


def printout(text, colour=WHITE, background=BLACK, effect=NO_EFFECT):
    """
    print() with colour
    """
    if HAS_COLOURS:
        seq = (
            "\x1b[%d;%d;%dm" % (effect, 30 + colour, 40 + background) + text + "\x1b[0m"
        )
        sys.stdout.write(seq + "\r\n")
    else:
        sys.stdout.write(text + "\r\n")


# OBJECTS to store config and data in
class ConfContainer:
    """
    Container for all the config variables
    """

    def __init__(self):
        pass


class AStep:
    """Represents a process step to be run"""

    def __init__(self, info, cmd, opt):
        self.info = info
        self.cmd = cmd
        self.opt = opt


class StepsStore:
    """List of steps with facilities to configure them"""

    def __init__(self):
        self.steps_data = [
            [
                "Colmap Feature Extraction",  # 0
                COLMAP_BIN,
                [
                    "feature_extractor",
                    "--database_path",
                    "%output_dir%/colmap.db",
                    "--image_path",
                    "%input_dir%/images",
                    "--ImageReader.canera_model",
                    "%camera_model%",
                    "--ImageReader.single_camera",
                    "1",
                ],
            ],
            [
                "Colmap Exhaustive Matcher",  # 1
                COLMAP_BIN,
                [
                    "exhaustive_matcher",
                    "--database_path",
                    "%output_dir%/colmap.db",
                    "--SiftMatching.guided_matching=true",
                ],
            ],
            [
                "Colmap Mapper",  # 2
                COLMAP_BIN,
                [
                    "mapper",
                    "--database_path",
                    "%output_dir%/colmap.db",
                    "--image_path",
                    "%input_dir%/images",
                    "--output_path",
                    "%output_dir%/sparse",
                    "--Mapper.extract_colors",
                    "%colored_points%",
                ],
            ],
            [
                "Colmap Bundle Adjuster",  # 3
                COLMAP_BIN,
                [
                    "bundle_adjuster",
                    "--input_path",
                    "%output_dir%/sparse/0",
                    "--output_path",
                    "%output_dir%/sparse/0",
                    "--BundleAdjustment.refine_principal_point",
                    "1",
                ],
            ],
            [
                "Colmap Undistorting Images",  # 4
                COLMAP_BIN,
                [
                    "image_undistorter",
                    "--image_path",
                    "%input_dir%/images",
                    "--input_path",
                    "%output_dir%/sparse/0",
                    "--output_path",
                    "%output_dir%/dense",
                    "--output_type",
                    "COLMAP",
                ],
            ],
            [
                "Colmap Model Converter",  # 5
                COLMAP_BIN,
                [
                    "model_converter",
                    "--input_path",
                    "%output_dir%/dense/sparse",
                    "--output_path",
                    "%output_dir%/dense/sparse",
                    "--output_type",
                    "TXT",
                ],
            ],
            [
                "Create MVS Scene",  # 6
                os.path.join(OPENMVS_BIN, "InterfaceCOLMAP"),
                [
                    "-w",
                    "%mvs_dir%",
                    "-i",
                    "%output_dir%/dense",
                    "-o",
                    "%mvs_dir%/scene.mvs",
                ],
            ],
            [
                "Densify point cloud",  # 7
                os.path.join(OPENMVS_BIN, "DensifyPointCloud"),
                [
                    "scene.mvs",
                    "-w",
                    '"%mvs_dir%"',
                ],
            ],
            [
                "Reconstruct the mesh",  # 8
                os.path.join(OPENMVS_BIN, "ReconstructMesh"),
                ["scene_dense.mvs", "-w", '"%mvs_dir%"'],
            ],
            [
                "Refine the mesh",  # 9
                os.path.join(OPENMVS_BIN, "RefineMesh"),
                [
                    "scene_dense_mesh.mvs",
                    "-w",
                    '"%mvs_dir%"',
                    "--resolution-level",
                    "1",
                    "--cuda-device",
                    "-1",
                ],
            ],
            [
                "Texture the mesh",  # 10
                os.path.join(OPENMVS_BIN, "TextureMesh"),
                [
                    "scene_dense_mesh_refine.mvs",
                    "-w",
                    '"%mvs_dir%"',
                    "--empty-color",
                    "%empty_color%",
                ],
            ],
            [
                "Estimate disparity-maps",  # 11
                os.path.join(OPENMVS_BIN, "DensifyPointCloud"),
                [
                    "scene.mvs",
                    "--dense-config-file",
                    "Densify.ini",
                    "--fusion-mode",
                    "-1",
                    "-w",
                    '"%mvs_dir%"',
                ],
            ],
            [
                "Fuse disparity-maps",  # 12
                os.path.join(OPENMVS_BIN, "DensifyPointCloud"),
                [
                    "scene.mvs",
                    "--dense-config-file",
                    "Densify.ini",
                    "--fusion-mode",
                    "-2",
                    "-w",
                    '"%mvs_dir%"',
                ],
            ],
        ]

    def __getitem__(self, indice):
        return AStep(*self.steps_data[indice])

    def length(self):
        return len(self.steps_data)

    def apply_conf(self, conf):
        """replace each %var% per conf.var value in steps data"""
        for s in self.steps_data:
            o2 = []
            for o in s[2]:
                co = o.replace("%input_dir%", conf.input_dir)
                co = co.replace("%output_dir%", conf.output_dir)
                co = co.replace("%matches_dir%", conf.matches_dir)
                co = co.replace("%reconstruction_dir%", conf.reconstruction_dir)
                co = co.replace("%mvs_dir%", conf.mvs_dir)
                co = co.replace("%camera_file_params%", conf.camera_file_params)
                o2.append(co)
            s[2] = o2

    def replace_opt(self, idx, str_exist, str_new):
        """replace each existing str_exist with str_new per opt value in step idx data"""
        s = self.steps_data[idx]
        o2 = []
        for o in s[2]:
            co = o.replace(str_exist, str_new)
            o2.append(co)
        s[2] = o2


CONF = ConfContainer()
STEPS = StepsStore()

# ARGS
PARSER = argparse.ArgumentParser(
    formatter_class=argparse.RawTextHelpFormatter,
    description="Photogrammetry reconstruction with these steps: \r\n"
    + "\r\n".join(
        (
            "\t%i. %s\t %s" % (t, STEPS[t].info, STEPS[t].cmd)
            for t in range(STEPS.length())
        )
    ),
)

PARSER.add_argument("input_dir", help="the directory which contains the pictures set.")
PARSER.add_argument(
    "output_dir", help="the directory which will contain the resulting files."
)
PARSER.add_argument("--steps", type=int, nargs="+", help="steps to process")
PARSER.add_argument(
    "--preset",
    help="steps list preset in \r\n"
    + " \r\n".join([k + " = " + str(PRESET[k]) for k in PRESET])
    + " \r\ndefault : "
    + PRESET_DEFAULT,
)
PARSER.add_argument(
    "--colored_points",
    default="1",
    help="If the colors for vertex points should be extracted (1) or not (0)",
)
PARSER.add_argument(
    "--empty_color", default="0", help="Color for fill-in texture (0 - black)"
)

GROUP = PARSER.add_argument_group(
    "Passthrough",
    description="Option to be passed to command lines (remove - in front of option names)\r\ne.g. --1 p ULTRA to use the ULTRA preset in openMVG_main_ComputeFeatures\r\nFor example, running the script as follows,\r\nMvgMvsPipeline.py input_dir output_dir --1 p HIGH n 8 --3 n ANNL2\r\nwhere --1 refer to openMVG_main_ComputeFeatures, p refers to\r\ndescriberPreset option which HIGH was chosen, and n refers to\r\nnumThreads which 8 was used. --3 refer to second step (openMVG_main_ComputeMatches),\r\nn refers to nearest_matching_method option which ANNL2 was chosen",
)
for n in range(STEPS.length()):
    GROUP.add_argument("--" + str(n), nargs="+")
PARSER.parse_args(namespace=CONF)  # store args in the ConfContainer


# FOLDERS
def mkdir_ine(dirname):
    """Create the folder if not presents"""
    if not os.path.exists(dirname):
        os.mkdir(dirname)


# Absolute path for input and output dirs
CONF.input_dir = os.path.abspath(CONF.input_dir)
CONF.output_dir = os.path.abspath(CONF.output_dir)

if not os.path.exists(CONF.input_dir):
    sys.exit("%s: path not found" % CONF.input_dir)

CONF.sparse_dir = os.path.join(CONF.output_dir, "sparse")
# CONF.reconstruction_dir = os.path.join(CONF.output_dir, "sfm")
# CONF.matches_dir = os.path.join(CONF.reconstruction_dir, "matches")
CONF.mvs_dir = os.path.join(CONF.output_dir, "mvs")
# CONF.camera_file_params = os.path.join(
#     CAMERA_SENSOR_DB_DIRECTORY, CAMERA_SENSOR_DB_FILE
# )
mkdir_ine(CONF.output_dir)
# mkdir_ine(CONF.reconstruction_dir)
# mkdir_ine(CONF.matches_dir)
mkdir_ine(CONF.sparse_dir)
mkdir_ine(CONF.mvs_dir)

# Update directories in steps commandlines
STEPS.apply_conf(CONF)

# PRESET
if CONF.steps and CONF.preset:
    sys.exit("Steps and preset arguments can't be set together.")
elif CONF.preset:
    try:
        CONF.steps = PRESET[CONF.preset]
    except KeyError:
        sys.exit(
            "Unknown preset %s, choose %s"
            % (CONF.preset, " or ".join([s for s in PRESET]))
        )
elif not CONF.steps:
    CONF.steps = PRESET[PRESET_DEFAULT]

# WALK
print("# Using input dir:  %s" % CONF.input_dir)
print("#      output dir:  %s" % CONF.output_dir)
print("#      camera model:  %s" % CONF.camera_model)
print("# Steps:  %s" % str(CONF.steps))
print("--- %s ---" % str(CONF.empty_color))

if 10 in CONF.steps:  # TextureMesh
    if 9 not in CONF.steps:  # RefineMesh
        # RefineMesh step is not run, use ReconstructMesh output
        STEPS.replace_opt(10, "scene_dense_mesh_refine.mvs", "scene_dense_mesh.mvs")

for cstep in CONF.steps:
    printout("#%i. %s" % (cstep, STEPS[cstep].info), effect=INVERSE)
    # Retrieve "passthrough" commandline options
    opt = getattr(CONF, str(cstep))
    if opt:
        # add - sign to short options and -- to long ones
        for o in range(0, len(opt), 2):
            if len(opt[o]) > 1:
                opt[o] = "-" + opt[o]
            opt[o] = "-" + opt[o]
    else:
        opt = []

    # Remove STEPS[cstep].opt options now defined in opt
    for anOpt in STEPS[cstep].opt:
        if anOpt in opt:
            idx = STEPS[cstep].opt.index(anOpt)
            if DEBUG:
                print(
                    "#\tRemove "
                    + str(anOpt)
                    + " from defaults options at id "
                    + str(idx)
                )
            del STEPS[cstep].opt[idx : idx + 2]

    # create a commandline for the current step
    cmdline = [STEPS[cstep].cmd] + STEPS[cstep].opt + opt
    print("Cmd: " + " ".join(cmdline))

    if not DEBUG:
        # Launch the current step
        try:
            pStep = subprocess.Popen(cmdline)
            pStep.wait()
            if pStep.returncode != 0:
                break
        except KeyboardInterrupt:
            sys.exit("\r\nProcess canceled by user, all files remains")
    else:
        print("\t".join(cmdline))
printout("# Pipeline end #", effect=INVERSE)
