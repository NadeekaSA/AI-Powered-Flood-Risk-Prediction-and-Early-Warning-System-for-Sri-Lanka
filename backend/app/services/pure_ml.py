import random
import math
import pickle

class DecisionTree:
    """A pure Python Decision Tree Classifier using Gini Impurity."""
    def __init__(self, max_depth=5, min_samples_split=2):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.tree = None

    def fit(self, X, y):
        self.tree = self._build_tree(X, y, depth=0)

    def _gini(self, y):
        if not y:
            return 0.0
        counts = {}
        for val in y:
            counts[val] = counts.get(val, 0) + 1
        return 1.0 - sum((c / len(y))**2 for c in counts.values())

    def _split(self, X, y, feature_idx, threshold):
        left_X, left_y = [], []
        right_X, right_y = [], []
        for x, label in zip(X, y):
            if x[feature_idx] <= threshold:
                left_X.append(x)
                left_y.append(label)
            else:
                right_X.append(x)
                right_y.append(label)
        return left_X, left_y, right_X, right_y

    def _best_split(self, X, y, feature_indices):
        best_gain = -1.0
        split_idx, split_thresh = None, None
        
        current_gini = self._gini(y)
        
        for idx in feature_indices:
            # Inspect unique values of this feature to find candidate thresholds
            values = sorted(list(set(x[idx] for x in X)))
            # If too many values, sample them to speed up splits
            if len(values) > 15:
                values = [values[i] for i in sorted(random.sample(range(len(values)), 15))]
                
            for thresh in values:
                l_X, l_y, r_X, r_y = self._split(X, y, idx, thresh)
                if not l_y or not r_y:
                    continue
                
                p_l = len(l_y) / len(y)
                p_r = len(r_y) / len(y)
                gain = current_gini - (p_l * self._gini(l_y) + p_r * self._gini(r_y))
                
                if gain > best_gain:
                    best_gain = gain
                    split_idx = idx
                    split_thresh = thresh
                    
        return split_idx, split_thresh

    def _build_tree(self, X, y, depth):
        num_samples = len(X)
        if num_samples == 0:
            return {"val": 0}
            
        num_features = len(X[0])
        unique_classes = set(y)
        
        # Base Cases: Pure node or limit reached
        if len(unique_classes) == 1:
            return {"val": list(unique_classes)[0]}
        if depth >= self.max_depth or num_samples < self.min_samples_split:
            most_common = max(unique_classes, key=y.count)
            return {"val": most_common}
            
        # Select feature subset (standard Random Forest approach)
        feature_indices = list(range(num_features))
        k = max(1, int(math.sqrt(num_features)))
        sampled_indices = random.sample(feature_indices, k)
        
        idx, thresh = self._best_split(X, y, sampled_indices)
        if idx is None:
            most_common = max(unique_classes, key=y.count)
            return {"val": most_common}
            
        l_X, l_y, r_X, r_y = self._split(X, y, idx, thresh)
        left_child = self._build_tree(l_X, l_y, depth + 1)
        right_child = self._build_tree(r_X, r_y, depth + 1)
        
        return {
            "feature_idx": idx,
            "threshold": thresh,
            "left": left_child,
            "right": right_child
        }

    def predict_row(self, x, node):
        if "val" in node:
            return node["val"]
        
        if x[node["feature_idx"]] <= node["threshold"]:
            return self.predict_row(x, node["left"])
        else:
            return self.predict_row(x, node["right"])


class RandomForest:
    """A pure Python Random Forest Classifier."""
    def __init__(self, n_estimators=15, max_depth=6, min_samples_split=2):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.trees = []

    def fit(self, X, y):
        self.trees = []
        n_samples = len(X)
        if n_samples == 0:
            return
            
        for _ in range(self.n_estimators):
            # Bootstrap sample
            boot_idx = [random.randint(0, n_samples - 1) for _ in range(n_samples)]
            boot_X = [X[i] for i in boot_idx]
            boot_y = [y[i] for i in boot_idx]
            
            tree = DecisionTree(max_depth=self.max_depth, min_samples_split=self.min_samples_split)
            tree.fit(boot_X, boot_y)
            self.trees.append(tree)

    def predict_row_prob(self, x):
        """Calculates class probabilities (Low=0, Medium=1, High=2, Critical=3)."""
        votes = [tree.predict_row(x, tree.tree) for tree in self.trees]
        counts = {}
        for v in votes:
            counts[v] = counts.get(v, 0) + 1
        
        probs = {}
        for c in [0, 1, 2, 3]:
            probs[c] = counts.get(c, 0) / len(votes)
        return probs

    def predict(self, X):
        """Predicts the final class label for each sample."""
        preds = []
        for x in X:
            votes = [tree.predict_row(x, tree.tree) for tree in self.trees]
            most_common = max(set(votes), key=votes.count)
            preds.append(most_common)
        return preds


class LinearRegression:
    """A pure Python Multivariate Linear Regression trained via Gradient Descent."""
    def __init__(self, lr=0.01, epochs=500):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0
        self.means = []
        self.stds = []

    def fit(self, X, y):
        n_samples = len(X)
        if n_samples == 0:
            return
        n_features = len(X[0])
        
        self.weights = [0.0] * n_features
        self.bias = 0.0
        
        # Standardize features for gradient descent stability
        self.means = []
        self.stds = []
        for j in range(n_features):
            col = [X[i][j] for i in range(n_samples)]
            mean = sum(col) / n_samples
            var = sum((x - mean)**2 for x in col) / n_samples
            std = math.sqrt(var) if var > 0 else 1.0
            self.means.append(mean)
            self.stds.append(std)
            
        scaled_X = []
        for i in range(n_samples):
            scaled_row = []
            for j in range(n_features):
                scaled_row.append((X[i][j] - self.means[j]) / self.stds[j])
            scaled_X.append(scaled_row)
            
        # Batch Gradient Descent
        for _ in range(self.epochs):
            dw = [0.0] * n_features
            db = 0.0
            for i in range(n_samples):
                y_pred = sum(scaled_X[i][j] * self.weights[j] for j in range(n_features)) + self.bias
                error = y_pred - y[i]
                
                for j in range(n_features):
                    dw[j] += error * scaled_X[i][j]
                db += error
                
            for j in range(n_features):
                self.weights[j] -= (self.lr * dw[j]) / n_samples
            self.bias -= (self.lr * db) / n_samples

    def predict(self, X):
        """Predicts float output values, ensuring no negative flood depth predictions."""
        preds = []
        for x in X:
            scaled_x = [(x[j] - self.means[j]) / self.stds[j] for j in range(len(x))]
            y_pred = sum(scaled_x[j] * self.weights[j] for j in range(len(x))) + self.bias
            preds.append(max(0.0, y_pred))
        return preds
