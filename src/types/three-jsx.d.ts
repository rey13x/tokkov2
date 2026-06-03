import * as React from 'react';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: React.DetailedHTMLProps<
        React.HTMLAttributes<THREE.Group> & { ref?: React.Ref<THREE.Group> },
        THREE.Group
      >;
      mesh: React.DetailedHTMLProps<
        React.HTMLAttributes<THREE.Mesh> & { ref?: React.Ref<THREE.Mesh> },
        THREE.Mesh
      >;
      directionalLight: React.DetailedHTMLProps<
        React.HTMLAttributes<THREE.DirectionalLight> & {
          ref?: React.Ref<THREE.DirectionalLight>;
        },
        THREE.DirectionalLight
      >;
      primitive: React.DetailedHTMLProps<
        React.HTMLAttributes<any> & { object: any; ref?: React.Ref<any> },
        any
      >;
    }
  }
}

export {};
