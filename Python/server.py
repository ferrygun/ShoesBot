import os
import keras
from keras.preprocessing import image
from keras.applications.imagenet_utils import decode_predictions, preprocess_input
from keras.models import Model
import pickle
from sklearn.decomposition import PCA
import numpy as np
import cv2
from scipy.spatial import distance
from flask import Flask, request, render_template, json
from skimage import io
import urllib.request

#port = int(os.getenv("PORT"))
port = 3000

def load_image_url(path):
    img = ''
    x = url_to_image(path, 224)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)
    return img, x


def get_closest_images(new_pca_features, pca_features, num_results=5):
    distances = [ distance.cosine(new_pca_features, feat) for feat in pca_features ]    
    idx_closest = sorted(range(len(distances)), key=lambda k: distances[k])[0:num_results]      
    return idx_closest, distances

def get_path_images(indexes):
    img_filename = []
    for idx in indexes:
        img_filename.append(images[idx])
    return img_filename

def transform_file(url):
	# load image and extract features
    new_image, x = load_image_url(url)
    new_features = feat_extractor.predict(x)

	# project it into pca space
    new_pca_features = pca.transform(new_features)[0]

	# calculate its distance to all the other images pca feature vectors
    idx_closest, distances = get_closest_images(new_pca_features, pca_features, 5)
    img_path = get_path_images(idx_closest)

    score = [distances[i] for i in idx_closest]

    return img_path, score

def toJSON(img_path, distances):
    return {"result": {'img_path': img_path, 'distances': distances}}


def url_to_image(url, resize=224):
  """
  downloads an image from url, converts to numpy array,
  resizes, and returns it
  """
  response = urllib.request.urlopen(url)
  img = np.asarray(bytearray(response.read()), dtype=np.uint8)
  img = cv2.imdecode(img, cv2.IMREAD_COLOR)
  img = cv2.resize(img, (resize, resize), interpolation=cv2.INTER_CUBIC)
  return img

model = keras.applications.VGG16(weights='imagenet', include_top=True)
import tensorflow as tf
graph = tf.get_default_graph()
feat_extractor = Model(inputs=model.input, outputs=model.get_layer("fc2").output)

images_path = 'static'
image_extensions = ['.jpg', '.png', '.jpeg']   # case-insensitive (upper/lower doesn't matter)
max_num_images = 10000

images = [os.path.join(dp, f) for dp, dn, filenames in os.walk(images_path) for f in filenames if os.path.splitext(f)[1].lower() in image_extensions]
if max_num_images < len(images):
    images = [images[i] for i in sorted(random.sample(xrange(len(images)), max_num_images))]

feature_path = 'feature/feature.pkl'
pca_features, pca = pickle.load(open(feature_path, 'rb'))

##Flask Setup #############################################
app = Flask(__name__)
@app.route('/img', methods = ['GET'])
def index():
    url = request.query_string.decode("utf-8") 
    url = url[4:]
    print(url)

    global graph
    with graph.as_default():
        img_path, score = transform_file(url)
    return (json.dumps(toJSON(img_path, score)))
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port)


