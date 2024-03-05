import React from "react";
import "./LargeButton.css";
import { Link } from "react-router-dom";

const LargeButton = ({
  to,
  _id,
  classNames,
  customStyles,
  _ref,
  clickFn,
  text,
}) => {
  return (
    <Link
      to={to ? to : null}
      id={_id ? _id : null}
      className={classNames ? classNames : null}
      style={customStyles ? customStyles : null}
      ref={_ref ? _ref : null}
      onClick={clickFn ? clickFn : null}
    >
      {text}
    </Link>
  );
};

export default LargeButton;
