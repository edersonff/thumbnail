#!/home/edersonff/.venvs/MyEnv/bin/python
import easyocr
import sys
import json
import cv2
import numpy as np

if len(sys.argv) != 2:
    print('Usage: python index.py <image_path>')
    sys.exit(1)

image = sys.argv[1]


reader = easyocr.Reader(['pt', 'en'], gpu=True)

results = reader.readtext(image)

responses = []

imagecv = cv2.imread(image)

def getPredominantColor(image):
    avg_color_per_row = np.average(image, axis=0)
    avg_color = np.average(avg_color_per_row, axis=0)
    avg_color = np.uint8(avg_color)
    avg_color = avg_color[::-1]
    avg_color = avg_color.tolist()
    return avg_color
    

def isYellowRGB(rgb):
    if rgb[0] > 100 and rgb[0] < 200 and rgb[1] > 100 and rgb[1] < 200 and rgb[2] > 0 and rgb[2] < 100:
        return True
    return False

for (bbox, text, prob) in results:
    cropped = imagecv[int(bbox[0][1]):int(bbox[2][1]), int(bbox[0][0]):int(bbox[2][0])]
    resize = cv2.resize(cropped, (100, 100))
    avg_color = getPredominantColor(resize)

    if isYellowRGB(avg_color):
        avg_color = [252, 223, 0]
    
    responses.append({
        'bbox': [[int(i) for i in arr] for arr in bbox],
        'text': text,
        'prob': float(prob),
        "color": avg_color
    })

print(json.dumps(responses))