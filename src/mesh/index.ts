import * as THREE from "three";

export function createCube(): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x56ccf2, metalness: 0.2, roughness: 0.7 });
    return new THREE.Mesh(geo, mat);
}
