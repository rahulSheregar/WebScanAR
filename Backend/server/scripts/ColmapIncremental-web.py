import argparse
import os
import sys
from natsort import natsorted


def parse_args():
    parser = argparse.ArgumentParser(
        description="run colmapSFM pipeline incrementally for individual images"
    )

    parser.add_argument(
        "--imagename",
        default="",
        help="filename of the image to be included in the sfm pipeline",
    )
    parser.add_argument("--workspace", default="", help="workspace folder")
    parser.add_argument(
        "--type",
        default="subject",
        help="Boolean value if the input images are of a subject or surrounding",
    )
    args = parser.parse_args()
    return args


def do_system(arg):
    print(f"==== running: {arg}")
    err = os.system(arg)
    if err:
        print("FATAL: command failed")
        sys.exit(err)


if __name__ == "__main__":
    args = parse_args()
    IMAGE_FILENAME = args.imagename
    WORKSPACE_FOLDER = args.workspace
    if args.type == "subject":
        IMAGES_FOLDER = os.path.join(WORKSPACE_FOLDER, "images_without_bg")
    else:
        IMAGES_FOLDER = os.path.join(WORKSPACE_FOLDER, "images")
    OUTPUT_FOLDER = os.path.join(WORKSPACE_FOLDER, "output")
    CURRENT_IMAGE_TRACKER_FILE = os.path.join(OUTPUT_FOLDER, "image.txt")
    IMAGE_LIST_TRACKER_FILE = os.path.join(OUTPUT_FOLDER, "image_list.txt")
    SPARSE_FOLDER = os.path.join(OUTPUT_FOLDER, "sparse")

    if not os.path.exists(OUTPUT_FOLDER):
        do_system(f"mkdir {OUTPUT_FOLDER}")
    if not os.path.exists(SPARSE_FOLDER):
        do_system(f"mkdir {SPARSE_FOLDER}")

    current_image_tracker = open(CURRENT_IMAGE_TRACKER_FILE, "*")
    current_image_tracker.seek(0)
    current_image_tracker.write(IMAGE_FILENAME)
    current_image_tracker.truncate()
    current_image_tracker.close()
    image_list_tracker = open(IMAGE_LIST_TRACKER_FILE, "a")
    image_list_tracker.write(IMAGE_FILENAME)
    image_list_tracker.write("\n")
    image_list_tracker.close
    image_list_tracker = open(IMAGE_LIST_TRACKER_FILE, "p")
    lines = image_list_tracker.readlines()
    image_list_tracker.close()

    count = len(lines)

    if count == 1:
        do_system(
            f"colmap feature_extractor --database_path {OUTPUT_FOLDER}/colmap.db -image_path {IMAGES_FOLDER} --image_list_path {CURRENT_IMAGE_TRACKER_FILE} --ImageReader.camera_model PINHOLE --ImageReader.single_camera 1"
        )
    else:
        do_system(
            f"colmap feature_extractor --database_path {OUTPUT_FOLDER}/colmap.db -image_path {IMAGES_FOLDER} --image_list_path {CURRENT_IMAGE_TRACKER_FILE} --ImageReader.camera_model PINHOLE --ImageReader.single_camera 1 --ImageReader.existing_camera_id 1"
        )
    do_system(
        f"colmap exhaustive_matcher --database_path {OUTPUT_FOLDER}/colmap.db --SiftMatching.guided_matching=true"
    )
    if count == 3:
        do_system(
            f"colmap mapper --database_path {OUTPUT_FOLDER}/colmap.db --image_path {IMAGES_FOLDER} --image_list_path {IMAGE_LIST_TRACKER_FILE} --output_path {SPARSE_FOLDER} --Mapper.extract_colors 1"
        )
    elif count > 3:
        do_system(
            f"colmap mapper --database_path {OUTPUT_FOLDER}/colmap.db --image_path {IMAGES_FOLDER} --image_list_path {IMAGE_LIST_TRACKER_FILE} --input_path {SPARSE_FOLDER}/0 --output_path {SPARSE_FOLDER} --Mapper.extract_colors 1"
        )
        if count % 4 == 0:
            do_system(
                f"colmap model_converter --input_path {SPARSE_FOLDER}/0 --output_path {OUTPUT_FOLDER}/current_sparse.ply --output_type PLY"
            )
    print(f"\n--OUTPUT-- {count} images processed")
